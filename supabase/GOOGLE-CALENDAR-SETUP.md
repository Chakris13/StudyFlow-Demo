# เชื่อม StudyFlow กับ Google Calendar

คู่มือนี้ตั้งค่าให้การบ้านที่เพิ่มใน StudyFlow และมีวันครบกำหนด ถูกสร้างเป็นกิจกรรมทั้งวันใน Google Calendar ของผู้ใช้แต่ละคน

## สิ่งที่ระบบทำ

- ผู้ใช้เข้าสู่ระบบ StudyFlow ก่อน แล้วเชื่อมบัญชี Google ที่ต้องการ
- เมื่อเพิ่มการบ้านที่มีวันครบกำหนด ระบบจะบันทึกการบ้านใน Supabase ก่อน แล้วจึงสร้าง Event ในปฏิทินหลักของ Google
- รายการสอบ/คะแนนสอบ และการบ้านที่ไม่ระบุวันครบกำหนด จะไม่ถูกส่งไป Google Calendar
- หาก Google Calendar ยังไม่เชื่อมต่อ หรือการซิงก์ล้มเหลว การบ้านยังคงถูกบันทึกใน StudyFlow และหน้า "ดูการบ้าน" จะแจ้งสถานะ
- การสร้าง Event ใช้รหัสคงที่จากรหัสการบ้าน เพื่อป้องกันการสร้าง Event ซ้ำเมื่อมีการลองส่งใหม่

## ขั้นตอน A — รัน SQL Migration

1. เปิด Supabase Dashboard ของโปรเจกต์ StudyFlow
2. เข้า **SQL Editor → New query**
3. เปิดไฟล์ `supabase/google-calendar-migration.sql` จาก Repository
4. คัดลอก SQL ทั้งหมดไปวางแล้วกด **Run**

Migration นี้เพิ่มคอลัมน์เก็บ Google Event ID/Link และสร้างตารางเก็บ OAuth state กับ Refresh Token แบบเข้ารหัส ตาราง Token และ State ไม่อนุญาตให้บทบาท `anon` หรือ `authenticated` อ่านได้; ใช้เฉพาะ Edge Functions ที่มี service-role key เท่านั้น

## ขั้นตอน B — เปิด Google Calendar API และสร้าง OAuth Client

1. เปิด [Google Cloud Console](https://console.cloud.google.com/).
2. สร้างหรือเลือก Google Cloud Project ที่ต้องการใช้กับ StudyFlow
3. ไปที่ **APIs & Services → Library** แล้วค้นหา **Google Calendar API** จากนั้นกด **Enable**
4. เข้า **Google Auth Platform → Branding** แล้วตั้งชื่อแอป เช่น `StudyFlow`
5. เข้า **Google Auth Platform → Audience**
   - เลือก External หากจะใช้กับบัญชี Google ทั่วไป
   - ระหว่างทดสอบ เลือกสถานะ Testing และเพิ่ม Gmail ที่จะใช้ทดสอบเป็น Test user
6. เข้า **Google Auth Platform → Data Access** แล้วตรวจ scope ที่ใช้:
   `https://www.googleapis.com/auth/calendar.events`
7. เข้า **Google Auth Platform → Clients → Create Client**
   - Application type: **Web application**
   - Name: `StudyFlow Web`
   - Authorized redirect URIs ให้เพิ่ม URL นี้แบบตรงตัว:

```text
https://qxfwcnupqqavszgcxfmh.supabase.co/functions/v1/google-calendar-oauth-callback
```

8. กด Create แล้วเก็บ **Client ID** และ **Client Secret** ไว้ อย่าส่ง Client Secret ในแชต อย่าใส่ไว้ใน JavaScript หรือ Repository

ไม่ต้องใช้ Google API Key สำหรับการเรียก Calendar ในระบบนี้ เพราะใช้ OAuth ของผู้ใช้แต่ละคน

## ขั้นตอน C — สร้าง Encryption Key บน Windows

เปิด PowerShell แล้วรันคำสั่งนี้เพื่อสร้างกุญแจสุ่ม 32 bytes สำหรับเข้ารหัส Refresh Token:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$GOOGLE_TOKEN_ENCRYPTION_KEY = [Convert]::ToBase64String($bytes)
$GOOGLE_TOKEN_ENCRYPTION_KEY
```

เก็บค่าที่แสดงไว้เพื่อใช้ในขั้นตอนถัดไป หากทำค่าหาย จะไม่สามารถถอดรหัส Refresh Token เดิมได้ และผู้ใช้ต้องเชื่อม Google ใหม่

## ขั้นตอน D — ใส่ Secrets ใน Supabase

1. ดาวน์โหลด/Clone Repository เวอร์ชันล่าสุดที่มีโฟลเดอร์ `supabase/functions`
2. เปิด Terminal ในโฟลเดอร์หลักของ Repository
3. ตรวจ Node.js ให้เป็นเวอร์ชัน 20 ขึ้นไป:
   `node -v`
4. ติดตั้ง Supabase CLI ในโฟลเดอร์โปรเจกต์:

```powershell
npm install supabase --save-dev
```

5. เข้าสู่ระบบและเชื่อมกับ Supabase Project:

```powershell
npx supabase login
npx supabase link --project-ref qxfwcnupqqavszgcxfmh
```

6. กำหนด Secrets ต่อไปนี้ (แทนค่าตัวอย่างด้วยค่าที่ได้จาก Google Cloud และ PowerShell):

```powershell
npx supabase secrets set GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" GOOGLE_TOKEN_ENCRYPTION_KEY="YOUR_BASE64_32_BYTE_KEY" --project-ref qxfwcnupqqavszgcxfmh
```

อย่า commit คำสั่งที่มีค่าจริงลงไฟล์หรือ GitHub และอย่าใช้ Supabase Secret/Service Role Key ในหน้าเว็บ

## ขั้นตอน E — Deploy Edge Functions

รันจากโฟลเดอร์ Repository เดิม:

```powershell
npx supabase functions deploy google-calendar-auth-url --project-ref qxfwcnupqqavszgcxfmh
npx supabase functions deploy google-calendar-oauth-callback --project-ref qxfwcnupqqavszgcxfmh
npx supabase functions deploy google-calendar-status --project-ref qxfwcnupqqavszgcxfmh
npx supabase functions deploy google-calendar-create-event --project-ref qxfwcnupqqavszgcxfmh
```

ไฟล์ `supabase/config.toml` กำหนดให้เฉพาะ `google-calendar-oauth-callback` ปิดการตรวจ Supabase JWT เพราะ Google จะ redirect มาที่ callback โดยตรง; ฟังก์ชันอื่นยังต้องใช้ Session ของ StudyFlow

## ขั้นตอน F — เชื่อมบัญชี Google จาก StudyFlow

1. เปิด [StudyFlow](https://chakris13.github.io/StudyFlow-Demo/)
2. เข้าสู่ระบบด้วยบัญชี StudyFlow ที่ลงทะเบียนแล้ว (บัญชี Guest ยังไม่รองรับการเชื่อม Calendar)
3. ไปที่ **ตั้งค่า → Google Calendar → เชื่อมต่อ Google Calendar**
4. เลือกบัญชี Google และยอมรับสิทธิ์ปฏิทิน
5. เมื่อกลับมาหน้า Settings ควรเห็นข้อความว่าเชื่อมต่อแล้ว

## ขั้นตอน G — ทดสอบ

1. ไปหน้า **จัดการบ้าน**
2. เพิ่มการบ้านทดสอบ โดยกรอกชื่อ วิชา และวันครบกำหนดในอนาคต
3. เปิด **ดูการบ้าน** แล้วตรวจข้อความว่าระบบเพิ่มลง Google Calendar แล้ว
4. เปิด [Google Calendar](https://calendar.google.com/) ด้วยบัญชี Google ที่เชื่อม แล้วตรวจวันที่ครบกำหนด

ระบบจะสร้างกิจกรรมแบบ **ทั้งวัน** ในวันที่ครบกำหนด ไม่ได้ตั้งเวลาเตือนเฉพาะชั่วโมง และใช้ค่า Default reminders ของ Google Calendar

## หมายเหตุสำคัญเกี่ยวกับโหมดทดสอบของ Google

ถ้า OAuth consent screen ยังอยู่ในสถานะ **Testing** Google จะจำกัดผู้ใช้ไว้เฉพาะ Test users ที่เพิ่มไว้ และ Refresh Token ของแอป External ในโหมด Testing ที่ใช้ Calendar scope จะหมดอายุใน 7 วัน ต้องเชื่อมบัญชีใหม่หลังจากนั้น หากต้องการใช้งานต่อเนื่องหรือเปิดให้ผู้ใช้ทั่วไป ต้องตรวจขั้นตอน Publishing/Verification ของ Google ตามข้อกำหนดของ scope นี้

## การรักษาความปลอดภัย

- ห้ามใส่ Google Client Secret, Supabase service-role key หรือ Encryption Key ในไฟล์ JavaScript/HTML
- Refresh Token ถูกเข้ารหัสด้วย AES-GCM ก่อนเก็บใน Supabase
- browser roles ไม่มีสิทธิ์อ่านตาราง `google_calendar_tokens` หรือ `google_calendar_oauth_states`
- Google OAuth state เป็นค่าใช้ครั้งเดียว มีอายุ 10 นาที และผูกกับบัญชี StudyFlow ที่เริ่มการเชื่อมต่อ
