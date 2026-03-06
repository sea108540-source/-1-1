import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').filter(Boolean).forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=').slice(1).join('=').trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=').slice(1).join('=').trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    console.log('Testing Sign Up...');
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'Password123!';

    let { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
    });

    if (authError) {
        console.error('Signup Error:', authError);
    }

    // Automatically signs in after signup usually, but let's try login
    let { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
    });

    if (loginError) {
        console.error('Login Error:', loginError);
        return;
    }

    const user = loginData.user;
    if (!user) {
        console.log("No user session.");
        return;
    }

    console.log(`Logged in as ${user.id}`);

    const fileName = `${user.id}/test_image.txt`;
    console.log(`Uploading to avatars/${fileName}...`);

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, 'Hello World', { upsert: true });

    if (uploadError) {
        console.error('Upload Error:', uploadError);
        console.error('Error Details:', uploadError.message, uploadError.name);
    } else {
        console.log('Upload Success:', uploadData);
    }
}

testUpload();
