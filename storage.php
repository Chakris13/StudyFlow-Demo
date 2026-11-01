<?php

function studyflow_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'httponly' => true,
        'secure' => $secure,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function studyflow_data_directory(): string
{
    $configured = getenv('STUDYFLOW_DATA_DIR');
    $directory = $configured !== false && $configured !== ''
        ? $configured
        : dirname(__DIR__) . DIRECTORY_SEPARATOR . '.studyflow-data';

    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the private StudyFlow data directory.');
    }

    return $directory;
}

function studyflow_read_users($handle): array
{
    rewind($handle);
    $contents = stream_get_contents($handle);
    if ($contents === false) {
        throw new RuntimeException('Unable to read account data.');
    }

    $users = $contents === '' ? [] : json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($users)) {
        throw new UnexpectedValueException('Account data must be a JSON array.');
    }

    return $users;
}

function studyflow_write_locked_json($handle, array $value): void
{
    $json = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    rewind($handle);
    if (!ftruncate($handle, 0)) {
        throw new RuntimeException('Unable to truncate the data file.');
    }

    $written = fwrite($handle, $json);
    if ($written !== strlen($json) || !fflush($handle)) {
        throw new RuntimeException('Unable to write the data file.');
    }
}

function studyflow_profile_path(string $userId): string
{
    if (!preg_match('/^[a-f0-9]{32}$/', $userId)) {
        throw new UnexpectedValueException('Invalid account.');
    }

    return studyflow_data_directory() . DIRECTORY_SEPARATOR . 'user-' . $userId . '.json';
}

function studyflow_default_profile(): array
{
    return ['homework' => [], 'settings' => new stdClass()];
}

function studyflow_read_profile(string $userId): array
{
    $path = studyflow_profile_path($userId);
    if (!file_exists($path)) {
        return studyflow_default_profile();
    }

    $handle = fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open account data.');
    }

    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Unable to lock account data.');
        }

        rewind($handle);
        $contents = stream_get_contents($handle);
        if ($contents === false) {
            throw new RuntimeException('Unable to read account data.');
        }

        $profile = $contents === ''
            ? studyflow_default_profile()
            : json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($profile) || !isset($profile['homework']) || !is_array($profile['homework'])) {
            throw new UnexpectedValueException('Account data is invalid.');
        }
        $profile['settings'] = $profile['settings'] ?? new stdClass();

        flock($handle, LOCK_UN);
        return $profile;
    } finally {
        fclose($handle);
    }
}

function studyflow_update_profile(string $userId, callable $update): array
{
    $path = studyflow_profile_path($userId);
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open account data.');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock account data.');
        }

        rewind($handle);
        $contents = stream_get_contents($handle);
        if ($contents === false) {
            throw new RuntimeException('Unable to read account data.');
        }

        $profile = $contents === ''
            ? studyflow_default_profile()
            : json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($profile) || !isset($profile['homework']) || !is_array($profile['homework'])) {
            throw new UnexpectedValueException('Account data is invalid.');
        }
        $profile['settings'] = $profile['settings'] ?? new stdClass();

        $profile = $update($profile);
        if (!is_array($profile) || !isset($profile['homework']) || !is_array($profile['homework'])) {
            throw new UnexpectedValueException('Account data update is invalid.');
        }
        studyflow_write_locked_json($handle, $profile);
        flock($handle, LOCK_UN);
        return $profile;
    } finally {
        fclose($handle);
    }
}
