<?php

require_once __DIR__ . '/storage.php';
studyflow_start_session();

header('Location: ' . (isset($_SESSION['studyflow_user_id']) ? 'index.html' : 'login.html'));
exit;
