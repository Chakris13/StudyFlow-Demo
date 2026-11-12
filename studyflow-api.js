// Shared data-access layer for StudyFlow.
// Row Level Security in Supabase ensures users can access only their own rows.
(() => {
    const client = window.studyFlowSupabase;

    function throwIfError(error) {
        if (error) throw new Error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }

    async function currentUser() {
        const { data, error } = await client.auth.getUser();
        throwIfError(error);
        if (!data.user) throw new Error('กรุณาเข้าสู่ระบบ');
        return data.user;
    }

    async function loadProfile() {
        const user = await currentUser();
        const [homeworkResult, profileResult] = await Promise.all([
            client.from('homework').select('*').order('created_at', { ascending: true }),
            client.from('user_profiles').select('settings').eq('user_id', user.id).maybeSingle()
        ]);
        throwIfError(homeworkResult.error);
        throwIfError(profileResult.error);
        return {
            homework: homeworkResult.data || [],
            settings: profileResult.data?.settings || {}
        };
    }

    async function addHomework(values) {
        const user = await currentUser();
        const row = {
            user_id: user.id,
            record_kind: values.record_kind || 'homework',
            hw_name: String(values.hw_name || '').trim(),
            hw_type: String(values.hw_type || '').trim(),
            subject: String(values.subject || '').trim(),
            due_date: values.due_date || null,
            test_date: values.test_date || null,
            score: values.score === '' || values.score == null ? null : Number(values.score),
            total_score: values.total_score === '' || values.total_score == null ? null : Number(values.total_score),
            notes: String(values.notes || '').trim()
        };
        if (!row.hw_name || !row.hw_type || !row.subject) {
            throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
        }
        const { data: inserted, error: insertError } = await client
            .from('homework')
            .insert(row)
            .select('id')
            .single();
        throwIfError(insertError);

        let calendarSync = 'not_applicable';
        let calendarMessage = '';
        if (row.record_kind === 'homework' && row.due_date) {
            if (user.is_anonymous) {
                calendarSync = 'not_connected';
            } else {
                try {
                    const { data: calendarResult, error: calendarError } = await client.functions.invoke(
                        'google-calendar-create-event',
                        { body: { homeworkId: inserted.id, calendarColorId: values.calendar_color_id || null } }
                    );
                    if (calendarError) {
                        calendarSync = 'failed';
                        calendarMessage = calendarError.message || 'ไม่สามารถติดต่อ Google Calendar ได้';
                        try {
                            const responseBody = await calendarError.context?.json();
                            if (responseBody?.error) calendarMessage = responseBody.error;
                        } catch {
                            // Keep the SDK error message.
                        }
                    } else if (!calendarResult?.connected) {
                        calendarSync = 'not_connected';
                    } else if (calendarResult.created || calendarResult.htmlLink) {
                        calendarSync = 'created';
                    } else {
                        calendarSync = 'failed';
                        calendarMessage = calendarResult?.error || 'ไม่สามารถเพิ่ม Event ได้';
                    }
                } catch (calendarError) {
                    calendarSync = 'failed';
                    calendarMessage = calendarError?.message || 'ไม่สามารถติดต่อ Google Calendar ได้';
                }
            }
        }

        return { id: inserted.id, calendarSync, calendarMessage };
    }

    async function editHomework(id, values) {
        const user = await currentUser();
        const patch = {
            hw_name: String(values.hw_name || '').trim(),
            hw_type: String(values.hw_type || '').trim(),
            subject: String(values.subject || '').trim(),
            due_date: values.due_date || null,
            notes: String(values.notes || '').trim()
        };
        if (!patch.hw_name || !patch.hw_type || !patch.subject) throw new Error('กรุณากรอกชื่อการบ้าน ประเภท และรายวิชาให้ครบ');
        const { data: existing, error: readError } = await client.from('homework')
            .select('id, record_kind, calendar_event_id').eq('id', id).eq('user_id', user.id).single();
        throwIfError(readError);
        if (existing.record_kind === 'exam') throw new Error('ไม่สามารถแก้ไขรายการสอบในส่วนนี้ได้');
        const { error: updateError } = await client.from('homework').update(patch).eq('id', id).eq('user_id', user.id);
        throwIfError(updateError);
        if (existing.calendar_event_id && patch.due_date && !user.is_anonymous) {
            const { error: syncError } = await client.functions.invoke('google-calendar-create-event', {
                body: { homeworkId: id, updateExisting: true }
            });
            if (syncError) {
                let detail = syncError.message || 'Google Calendar sync failed';
                try { const body = await syncError.context?.json(); if (body?.error) detail = body.error; } catch {}
                throw new Error('บันทึกการบ้านแล้ว แต่ปรับปรุง Google Calendar ไม่สำเร็จ: ' + detail);
            }
        }
    }

    async function updateHomework(id, action) {
        await currentUser();
        if (action === 'delete_homework') {
            const { data, error } = await client.from('homework').delete().eq('id', id).select('id');
            throwIfError(error);
            if (!data?.length) throw new Error('ไม่พบรายการการบ้าน');
            return;
        }

        const { data: existing, error: readError } = await client
            .from('homework').select('id, completed, ready_to_submit, submitted')
            .eq('id', id).single();
        throwIfError(readError);

        if (existing.submitted) throw new Error('การบ้านนี้ส่งแล้ว');
        const now = new Date().toISOString();
        let patch;
        if (action === 'prepare_homework') {
            patch = { ready_to_submit: true, completed: true, completed_at: now };
        } else if (action === 'submit_homework') {
            if (!existing.ready_to_submit && !existing.completed) {
                throw new Error('กดเสร็จก่อนส่งการบ้าน');
            }
            patch = { ready_to_submit: true, completed: true, submitted: true, submitted_at: now };
        } else {
            throw new Error('คำขอไม่ถูกต้อง');
        }

        const { error } = await client.from('homework').update(patch).eq('id', id);
        throwIfError(error);
    }

    async function saveSettings(settings) {
        const user = await currentUser();
        const { error } = await client.from('user_profiles').upsert(
            { user_id: user.id, settings: settings || {} },
            { onConflict: 'user_id' }
        );
        throwIfError(error);
    }

    window.StudyFlowAPI = {
        currentUser,
        loadProfile,
        addHomework,
        editHomework,
        updateHomework,
        saveSettings
    };
})();
