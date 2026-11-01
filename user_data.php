<?php

require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
studyflow_start_session();

function user_data_response(array $result, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isset($_SESSION['studyflow_user_id'])) {
    user_data_response(['error' => 'กรุณาเข้าสู่ระบบ'], 401);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        user_data_response(studyflow_read_profile($_SESSION['studyflow_user_id']));
    } catch (Throwable $error) {
        error_log('StudyFlow profile read error: ' . $error->getMessage());
        user_data_response(['error' => 'ไม่สามารถโหลดข้อมูลบัญชีได้'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    user_data_response(['error' => 'Method not allowed.'], 405);
}

$token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!isset($_SESSION['studyflow_csrf']) || !hash_equals($_SESSION['studyflow_csrf'], $token)) {
    user_data_response(['error' => 'คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่'], 403);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    user_data_response(['error' => 'ข้อมูลคำขอไม่ถูกต้อง'], 400);
}

try {
    $profile = studyflow_update_profile($_SESSION['studyflow_user_id'], static function (array $profile) use ($payload): array {
        $action = $payload['action'] ?? '';
        if ($action === 'save_settings') {
            if (!isset($payload['settings']) || !is_array($payload['settings'])) {
                throw new InvalidArgumentException('ข้อมูลการตั้งค่าไม่ถูกต้อง');
            }
            $profile['settings'] = $payload['settings'];
            return $profile;
        }

        if (!in_array($action, ['add_homework', 'delete_homework', 'prepare_homework', 'submit_homework'], true)) {
            throw new InvalidArgumentException('คำขอไม่ถูกต้อง');
        }

        if ($action === 'add_homework') {
            foreach (['hw_name', 'hw_type', 'subject'] as $field) {
                if (!isset($payload[$field]) || trim((string)$payload[$field]) === '') {
                    throw new InvalidArgumentException('กรุณากรอกข้อมูลการบ้านให้ครบ');
                }
            }
            $profile['homework'][] = [
                'hw_name' => trim((string)$payload['hw_name']),
                'hw_type' => trim((string)$payload['hw_type']),
                'subject' => trim((string)$payload['subject']),
                'due_date' => trim((string)($payload['due_date'] ?? '')),
                'notes' => trim((string)($payload['notes'] ?? '')),
                'created_at' => gmdate(DATE_ATOM),
                'completed' => false,
                'ready_to_submit' => false,
                'submitted' => false,
            ];
            return $profile;
        }

        if (!in_array($action, ['delete_homework', 'prepare_homework', 'submit_homework'], true)) {
            throw new InvalidArgumentException('คำขอไม่ถูกต้อง');
        }

        $index = filter_var($payload['index'] ?? null, FILTER_VALIDATE_INT);
        if ($index === false || $index === null || $index < 0 || !array_key_exists($index, $profile['homework'])) {
            throw new OutOfBoundsException('ไม่พบรายการการบ้าน');
        }

        if ($action === 'delete_homework') {
            array_splice($profile['homework'], $index, 1);
        } elseif ($action === 'prepare_homework') {
            if (!empty($profile['homework'][$index]['submitted'])) {
                throw new DomainException('การบ้านนี้ส่งแล้ว');
            }
            $profile['homework'][$index]['ready_to_submit'] = true;
            $profile['homework'][$index]['completed'] = true;
            $profile['homework'][$index]['completed_at'] = gmdate(DATE_ATOM);
        } else {
            if (!empty($profile['homework'][$index]['submitted'])) {
                throw new DomainException('การบ้านนี้ส่งแล้ว');
            }
            if (
                empty($profile['homework'][$index]['ready_to_submit']) &&
                empty($profile['homework'][$index]['completed'])
            ) {
                throw new DomainException('กดเสร็จก่อนส่งการบ้าน');
            }
            $profile['homework'][$index]['ready_to_submit'] = true;
            $profile['homework'][$index]['completed'] = true;
            $profile['homework'][$index]['submitted'] = true;
            $profile['homework'][$index]['submitted_at'] = gmdate(DATE_ATOM);
        }
        return $profile;
    });

    user_data_response($profile);
} catch (DomainException $error) {
    user_data_response(['error' => $error->getMessage()], 409);
} catch (InvalidArgumentException $error) {
    user_data_response(['error' => $error->getMessage()], 400);
} catch (OutOfBoundsException $error) {
    user_data_response(['error' => $error->getMessage()], 404);
} catch (Throwable $error) {
    error_log('StudyFlow profile update error: ' . $error->getMessage());
    user_data_response(['error' => 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่'], 500);
}
