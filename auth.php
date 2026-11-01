<?php

require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
studyflow_start_session();

function auth_response(array $result, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

function auth_save_session(string $userId, string $identifier, bool $guest): void
{
    session_regenerate_id(true);
    $_SESSION['studyflow_user_id'] = $userId;
    $_SESSION['studyflow_identifier'] = $identifier;
    $_SESSION['studyflow_guest'] = $guest;
    $_SESSION['studyflow_csrf'] = bin2hex(random_bytes(32));
}

function auth_verify_password(string $password, string $storedHash): bool
{
    if (str_starts_with($storedHash, '$pbkdf2-sha256$')) {
        $parts = explode('$', $storedHash);
        if (count($parts) !== 5 || !ctype_digit($parts[2])) {
            return false;
        }

        $iterations = (int)$parts[2];
        $salt = base64_decode($parts[3], true);
        $expectedHash = base64_decode($parts[4], true);
        if (
            $iterations < 100000 ||
            $iterations > 1000000 ||
            $salt === false ||
            strlen($salt) < 16 ||
            $expectedHash === false ||
            strlen($expectedHash) !== 32
        ) {
            return false;
        }

        $actualHash = hash_pbkdf2('sha256', $password, $salt, $iterations, 32, true);
        return hash_equals($expectedHash, $actualHash);
    }

    return password_verify($password, $storedHash);
}

function auth_load_accounts(bool $write, callable $operation)
{
    $handle = fopen(studyflow_data_directory() . DIRECTORY_SEPARATOR . 'users.json', 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open account data.');
    }

    try {
        if (!flock($handle, $write ? LOCK_EX : LOCK_SH)) {
            throw new RuntimeException('Unable to lock account data.');
        }
        $users = studyflow_read_users($handle);
        $result = $operation($users);
        if ($write) {
            studyflow_write_locked_json($handle, $users);
        }
        flock($handle, LOCK_UN);
        return $result;
    } finally {
        fclose($handle);
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'session') {
        if (!isset($_SESSION['studyflow_user_id'])) {
            auth_response(['authenticated' => false]);
        }

        auth_response([
            'authenticated' => true,
            'identifier' => $_SESSION['studyflow_identifier'],
            'guest' => $_SESSION['studyflow_guest'],
            'csrf' => $_SESSION['studyflow_csrf'],
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        auth_response(['error' => 'Method not allowed.'], 405);
    }

    $action = $_POST['action'] ?? '';
    if ($action === 'logout') {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!isset($_SESSION['studyflow_csrf']) || !hash_equals($_SESSION['studyflow_csrf'], $token)) {
            auth_response(['error' => 'คำขอไม่ถูกต้อง กรุณาลองใหม่'], 403);
        }

        $_SESSION = [];
        session_destroy();
        auth_response(['ok' => true]);
    }

    if ($action === 'guest') {
        $userId = bin2hex(random_bytes(16));
        studyflow_update_profile($userId, static function (array $profile): array {
            return $profile;
        });
        auth_save_session($userId, 'ผู้ใช้ไม่ระบุตัวตน', true);
        auth_response(['ok' => true]);
    }

    $identifier = trim($_POST['identifier'] ?? '');
    $password = $_POST['password'] ?? '';
    if ($identifier === '' || strlen($identifier) > 254 || $password === '') {
        auth_response(['error' => 'กรุณากรอกรหัสนักเรียน / Email และรหัสผ่าน'], 400);
    }

    $normalizedIdentifier = function_exists('mb_strtolower')
        ? mb_strtolower($identifier, 'UTF-8')
        : strtolower($identifier);

    if ($action === 'register') {
        if (strlen($password) < 8) {
            auth_response(['error' => 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'], 400);
        }

        $user = [
            'id' => bin2hex(random_bytes(16)),
            'identifier' => $identifier,
            'normalized_identifier' => $normalizedIdentifier,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'guest' => false,
        ];

        auth_load_accounts(true, static function (array &$users) use ($normalizedIdentifier, $user): void {
            foreach ($users as $existingUser) {
                if (($existingUser['normalized_identifier'] ?? '') === $normalizedIdentifier) {
                    throw new DomainException('บัญชีนี้ลงทะเบียนแล้ว');
                }
            }
            $users[] = $user;
        });

        studyflow_update_profile($user['id'], static function (array $profile): array {
            return $profile;
        });
        auth_save_session($user['id'], $user['identifier'], false);
        auth_response(['ok' => true]);
    }

    if ($action === 'login') {
        $user = auth_load_accounts(false, static function (array &$users) use ($normalizedIdentifier) {
            foreach ($users as $account) {
                if (($account['normalized_identifier'] ?? '') === $normalizedIdentifier) {
                    return $account;
                }
            }
            return null;
        });

        if ($user === null || !auth_verify_password($password, $user['password_hash'] ?? '')) {
            auth_response(['error' => 'รหัสนักเรียน / Email หรือรหัสผ่านไม่ถูกต้อง'], 401);
        }

        auth_save_session($user['id'], $user['identifier'], false);
        auth_response(['ok' => true]);
    }

    auth_response(['error' => 'คำขอไม่ถูกต้อง'], 400);
} catch (DomainException $error) {
    auth_response(['error' => $error->getMessage()], 409);
} catch (Throwable $error) {
    error_log('StudyFlow auth error: ' . $error->getMessage());
    auth_response(['error' => 'เกิดข้อผิดพลาดในการจัดการบัญชี กรุณาลองใหม่'], 500);
}
