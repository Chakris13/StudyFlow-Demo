<?php

require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
studyflow_start_session();

if (!isset($_SESSION['studyflow_user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'กรุณาเข้าสู่ระบบ'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    echo json_encode(
        studyflow_read_profile($_SESSION['studyflow_user_id'])['homework'],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );
} catch (Throwable $error) {
    error_log('StudyFlow homework read error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'ไม่สามารถโหลดรายการการบ้านได้'], JSON_UNESCAPED_UNICODE);
}
