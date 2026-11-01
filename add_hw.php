<?php

require_once __DIR__ . '/storage.php';
studyflow_start_session();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed.');
}

if (!isset($_SESSION['studyflow_user_id'])) {
    header('Location: login.html');
    exit;
}

$token = $_POST['csrf'] ?? '';
if (!isset($_SESSION['studyflow_csrf']) || !hash_equals($_SESSION['studyflow_csrf'], $token)) {
    http_response_code(403);
    exit('คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่');
}

$homework = [];
foreach (['hw_name', 'hw_type', 'subject'] as $field) {
    $value = trim($_POST[$field] ?? '');
    if ($value === '') {
        http_response_code(400);
        exit('Please complete all required homework fields.');
    }
    $homework[$field] = $value;
}
$homework['due_date'] = trim($_POST['due_date'] ?? '');
$homework['notes'] = trim($_POST['notes'] ?? '');
$homework['created_at'] = gmdate(DATE_ATOM);
$homework['completed'] = false;

try {
    studyflow_update_profile($_SESSION['studyflow_user_id'], static function (array $profile) use ($homework): array {
        $profile['homework'][] = $homework;
        return $profile;
    });
} catch (Throwable $error) {
    error_log('StudyFlow homework save error: ' . $error->getMessage());
    http_response_code(500);
    exit('Unable to save the homework entry.');
}

header('Location: ViewHW.html?saved=1');
exit;
