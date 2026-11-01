<?php

require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=utf-8');
studyflow_start_session();

function homework_action_response(array $result, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isset($_SESSION['studyflow_user_id'])) {
    homework_action_response(['error' => 'กรุณาเข้าสู่ระบบ'], 401);
}

$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!isset($_SESSION['studyflow_csrf']) || !hash_equals($_SESSION['studyflow_csrf'], $token)) {
    homework_action_response(['error' => 'คำขอไม่ถูกต้อง'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    homework_action_response(['error' => 'Method not allowed.'], 405);
}

$action = $_POST['action'] ?? '';
$index = filter_var($_POST['index'] ?? null, FILTER_VALIDATE_INT);
if (!in_array($action, ['delete', 'complete'], true) || $index === false || $index === null || $index < 0) {
    homework_action_response(['error' => 'Invalid homework action.'], 400);
}

try {
    $profile = studyflow_update_profile($_SESSION['studyflow_user_id'], static function (array $profile) use ($action, $index): array {
        if (!array_key_exists($index, $profile['homework'])) {
            throw new OutOfBoundsException('Homework entry was not found.');
        }

        if ($action === 'delete') {
            array_splice($profile['homework'], $index, 1);
        } else {
            $profile['homework'][$index]['completed'] = true;
        }
        return $profile;
    });
    homework_action_response(['homework' => $profile['homework']]);
} catch (OutOfBoundsException $error) {
    homework_action_response(['error' => $error->getMessage()], 404);
} catch (Throwable $error) {
    error_log('StudyFlow homework action error: ' . $error->getMessage());
    homework_action_response(['error' => 'Unable to save the homework changes.'], 500);
}
