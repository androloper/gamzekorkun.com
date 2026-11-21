<?php
declare(strict_types=1);

// Copy OUTSIDE public_html as /home/ACCOUNT/gamzekorkun-mail-config.php.
// Never commit the real password or upload the config under the web root.
return [
    'transport' => 'smtp',
    'from_email' => 'webform@gamzekorkun.com',
    'from_name' => 'Gamze Korkun Web İletişim',
    // Replace with the actual SMTP values from the NiobeHosting email panel.
    'smtp_host' => 'SMTP_HOST_FROM_HOSTING_PANEL',
    'smtp_port' => 587,
    'smtp_encryption' => 'tls', // For port 465 use 'ssl'.
    'smtp_username' => 'webform@gamzekorkun.com',
    'smtp_password' => 'SET_ONLY_IN_THE_PRIVATE_SERVER_FILE',
];
