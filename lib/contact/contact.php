<?php
declare(strict_types=1);

namespace GamzeKorkun\Contact;

use PHPMailer\PHPMailer\PHPMailer;

// Test recipient. This value is never taken from a browser request.
const RECIPIENT = 'ramazanbayborek@gmail.com';
const TOKEN_TTL = 3600;
const MAX_REQUEST_BYTES = 32768;

function response(int $status, string $message, array $extra = []): array
{
    return [$status, array_merge(['ok' => $status >= 200 && $status < 300, 'message' => $message], $extra)];
}

function scalarField(array $input, string $name): ?string
{
    if (!array_key_exists($name, $input) || !is_string($input[$name])) {
        return null;
    }
    $value = trim($input[$name]);
    return preg_match('//u', $value) === 1 ? $value : null;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : (int) preg_match_all('/./us', $value);
}

function originAllowed(array $server): bool
{
    if (($server['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        return false;
    }
    $origin = $server['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return true; // The session-bound CSRF token is still mandatory for POST.
    }
    $parts = parse_url($origin);
    if (!is_array($parts) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment']) || !empty($parts['path'])) {
        return false;
    }
    $host = strtolower($parts['host'] ?? '');
    $scheme = $parts['scheme'] ?? '';
    if (in_array($host, ['gamzekorkun.com', 'www.gamzekorkun.com'], true)) {
        return $scheme === 'https' && (!isset($parts['port']) || $parts['port'] === 443);
    }
    $requestHost = strtolower(explode(':', (string) ($server['HTTP_HOST'] ?? ''))[0]);
    return in_array($requestHost, ['127.0.0.1', 'localhost'], true)
        && $host === $requestHost && $scheme === 'http';
}

/** Sender and limiter are injected so tests cannot accidentally send real mail. */
function handle(array $server, array $input, array &$session, callable $sender, callable $limiter, ?int $now = null): array
{
    $now = $now ?? time();
    $method = strtoupper((string) ($server['REQUEST_METHOD'] ?? ''));
    if (!in_array($method, ['GET', 'POST'], true)) {
        return response(405, 'Bu işlem için GET veya POST isteği kullanılmalıdır.');
    }
    if (!originAllowed($server)) {
        return response(403, 'Gönderim isteği doğrulanamadı. Lütfen iletişim sayfasını yenileyin.');
    }
    if ($method === 'GET') {
        if (!is_string($session['token'] ?? null) || ($session['issued_at'] ?? 0) + TOKEN_TTL <= $now) {
            $session['token'] = bin2hex(random_bytes(32));
            $session['issued_at'] = $now;
        }
        return response(200, '', ['token' => $session['token']]);
    }
    if ((int) ($server['CONTENT_LENGTH'] ?? 0) > MAX_REQUEST_BYTES) {
        return response(413, 'Mesaj çok uzun. Lütfen kısaltıp tekrar deneyin.');
    }
    $contentType = strtolower(explode(';', (string) ($server['CONTENT_TYPE'] ?? ''))[0]);
    if (!in_array($contentType, ['multipart/form-data', 'application/x-www-form-urlencoded'], true)) {
        return response(415, 'Form biçimi desteklenmiyor. Lütfen iletişim sayfasını kullanın.');
    }
    $token = scalarField($input, 'csrf_token');
    if (!$token || !is_string($session['token'] ?? null) || ($session['issued_at'] ?? 0) + TOKEN_TTL <= $now || !hash_equals($session['token'], $token)) {
        return response(403, 'Formun doğrulama süresi doldu. Lütfen yeniden gönderin.');
    }
    $trap = $input['website'] ?? '';
    if (!is_string($trap) || trim($trap) !== '') {
        return response(422, 'Form gönderilemedi. Lütfen bilgileri kontrol edin.');
    }
    $fields = [
        'ad-soyad' => ['label' => 'Ad Soyad', 'min' => 2, 'max' => 100],
        'telefon' => ['label' => 'Telefon Numarası', 'min' => 7, 'max' => 32],
        'mesaj' => ['label' => 'Mesaj', 'min' => 10, 'max' => 5000],
    ];
    $data = [];
    foreach ($fields as $name => $rules) {
        $value = scalarField($input, $name);
        if ($value === null || textLength($value) < $rules['min'] || textLength($value) > $rules['max']) {
            return response(422, $rules['label'] . ' alanını kontrol edin.', ['field' => $name]);
        }
        $controlPattern = $name === 'mesaj' ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/' : '/[\x00-\x1F\x7F]/';
        if (preg_match($controlPattern, $value)) {
            return response(422, $rules['label'] . ' alanında geçersiz karakter var.', ['field' => $name]);
        }
        $data[$name] = $value;
    }
    $phoneDigits = preg_replace('/[^0-9]/', '', $data['telefon']);
    if (preg_match('/^\+?[0-9(). \-]+$/D', $data['telefon']) !== 1 || strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
        return response(422, 'Geçerli bir telefon numarası girin.', ['field' => 'telefon']);
    }
    if ($session['sending'] ?? false) {
        return response(429, 'Gönderim işleniyor. Lütfen biraz bekleyin.');
    }
    try {
        $wait = $limiter($now);
        if ($wait > 0) {
            return response(429, 'Kısa sürede çok fazla gönderim yapıldı. Lütfen biraz sonra tekrar deneyin.', ['retryAfter' => $wait]);
        }
        $session['sending'] = true;
        $accepted = $sender($data);
    } catch (\Throwable $error) {
        // Never log the message, contact details, SMTP credentials, or detailed transport response.
        error_log('[gamzekorkun-contact] Mail transport unavailable. Check server mail configuration.');
        $accepted = false;
    } finally {
        $session['sending'] = false;
    }
    if (!$accepted) {
        return response(503, 'Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin veya telefon/e-posta ile iletişime geçin.');
    }
    return response(200, 'Mesajınız e-posta sunucusuna iletildi. Teşekkür ederiz.');
}

function config(): array
{
    $config = [
        'transport' => getenv('CONTACT_TRANSPORT') ?: 'mail',
        'from_email' => getenv('CONTACT_FROM_EMAIL') ?: 'webform@gamzekorkun.com',
        'from_name' => 'Gamze Korkun Web İletişim',
        'smtp_host' => getenv('CONTACT_SMTP_HOST') ?: '',
        'smtp_port' => (int) (getenv('CONTACT_SMTP_PORT') ?: 587),
        'smtp_encryption' => getenv('CONTACT_SMTP_ENCRYPTION') ?: 'tls',
        'smtp_username' => getenv('CONTACT_SMTP_USERNAME') ?: '',
        'smtp_password' => getenv('CONTACT_SMTP_PASSWORD') ?: '',
    ];
    // lib/contact is two levels below the web root; config lives above that root.
    $file = dirname(__DIR__, 3) . '/gamzekorkun-mail-config.php';
    if (is_file($file)) {
        $override = require $file;
        if (!is_array($override)) {
            throw new \RuntimeException('Invalid mail configuration');
        }
        $config = array_replace($config, $override);
    }
    return $config;
}

function buildMessage(array $data, array $config): PHPMailer
{
    $mail = new PHPMailer(true);
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->SMTPDebug = 0;
    $mail->Timeout = 15;
    if ($config['transport'] === 'smtp') {
        if (!$config['smtp_host'] || !$config['smtp_username'] || !$config['smtp_password']) {
            throw new \RuntimeException('SMTP is not configured');
        }
        if (!in_array($config['smtp_encryption'], ['tls', 'ssl'], true)) {
            throw new \RuntimeException('TLS is required');
        }
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->Port = (int) $config['smtp_port'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_username'];
        $mail->Password = $config['smtp_password'];
        $mail->SMTPSecure = $config['smtp_encryption'];
    } elseif ($config['transport'] === 'mail') {
        $mail->isMail();
    } else {
        throw new \RuntimeException('Unsupported mail transport');
    }
    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress(RECIPIENT);
    $mail->isHTML(false);
    $mail->Subject = '[gamzekorkun.com] Yeni iletişim mesajı';
    $mail->Body = "Web sitesi iletişim formundan yeni mesaj\n\n"
        . 'Ad Soyad: ' . $data['ad-soyad'] . "\n"
        . 'Telefon: ' . $data['telefon'] . "\n\n"
        . "Mesaj:\n" . str_replace(["\r\n", "\r"], "\n", $data['mesaj']);
    return $mail;
}

/** Atomic, per-IP rate limit. Only counters and timestamps are stored, not form contents. */
function rateLimit(int $now, string $ip, ?string $baseDir = null): int
{
    $dir = $baseDir ?? (sys_get_temp_dir() . '/gamzekorkun-contact-' . substr(hash('sha256', __DIR__), 0, 12));
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new \RuntimeException('Rate limiter unavailable');
    }
    // Fixed-size slots bound disk usage even under rotating-IP traffic. A collision is conservative.
    $slot = hexdec(substr(hash('sha256', $ip), 0, 3));
    $file = $dir . '/limit-' . $slot . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        throw new \RuntimeException('Rate limiter lock unavailable');
    }
    @chmod($file, 0600);
    try {
        $state = json_decode(stream_get_contents($handle), true);
        if (!is_array($state) || ($state['start'] ?? 0) + 900 <= $now) {
            $state = ['start' => $now, 'last' => 0, 'count' => 0];
        }
        $wait = max(0, (int) $state['last'] + 60 - $now);
        if ($state['count'] >= 5) $wait = max($wait, (int) $state['start'] + 900 - $now);
        if ($wait > 0) return $wait;
        $state['last'] = $now;
        $state['count']++;
        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, json_encode($state)) === false || !fflush($handle)) {
            throw new \RuntimeException('Rate limiter write unavailable');
        }
        return 0;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
