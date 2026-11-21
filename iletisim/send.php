<?php
declare(strict_types=1);

use function GamzeKorkun\Contact\handle;
use function GamzeKorkun\Contact\buildMessage;
use function GamzeKorkun\Contact\config;
use function GamzeKorkun\Contact\rateLimit;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Vary: Cookie');

try {
    require_once dirname(__DIR__) . '/lib/phpmailer/Exception.php';
    require_once dirname(__DIR__) . '/lib/phpmailer/PHPMailer.php';
    require_once dirname(__DIR__) . '/lib/phpmailer/SMTP.php';
    require_once dirname(__DIR__) . '/lib/contact/contact.php';

    ini_set('session.use_strict_mode', '1');
    session_name('GKCContact');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/iletisim/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    if (!session_start()) throw new RuntimeException('Session unavailable');

    [$status, $body] = handle(
        $_SERVER, $_POST, $_SESSION,
        static function (array $data): bool { return buildMessage($data, config())->send(); },
        static function (int $now): int { return rateLimit($now, $_SERVER['REMOTE_ADDR'] ?? 'unknown'); }
    );
    session_write_close();
} catch (Throwable $error) {
    error_log('[gamzekorkun-contact] Endpoint initialization unavailable.');
    $status = 503;
    $body = ['ok' => false, 'message' => 'Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin veya telefon/e-posta ile iletişime geçin.'];
}
if ($status === 405) header('Allow: GET, POST');
if ($status === 429) header('Retry-After: ' . (int) ($body['retryAfter'] ?? 60));
http_response_code($status);
echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
