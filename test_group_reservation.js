import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = 'https://weumwmalmuaddejkumyx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndldW13bWFsbXVhZGRlamt1bXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTA3MDEsImV4cCI6MjA4ODQyNjcwMX0.t11fuWzP41W3ft_FIsm0IC5Ptm9FyQWneEp1R_0CL9E';

// Supabase client config
const authConfig = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
};

const supabaseA = createClient(supabaseUrl, supabaseKey, authConfig);
const supabaseB = createClient(supabaseUrl, supabaseKey, authConfig);

async function runTest() {
    console.log("=== グループ予約機能の自動テストを開始します ===");

    const emailA = `test_a_${Date.now()}@test.com`;
    const emailB = `test_b_${Date.now()}@test.com`;
    const password = "password123!";

    console.log(`1. テストユーザーA(${emailA})とB(${emailB})を作成中...`);

    const { data: userA, error: errA } = await supabaseA.auth.signUp({
        email: emailA,
        password: password,
        options: { data: { display_name: 'TestA', username: `test_a_${Date.now()}` } }
    });

    if (errA) {
        console.error("ユーザーAの作成に失敗しました:", errA.message);
        if (errA.message.includes("rate limit") || errA.message.includes("429")) {
            console.error("【重要】Supabaseのメール送信制限に引っかかっています。\nテストを続行するには、Supabaseダッシュボードから Authentication > Providers > Email の「Confirm email」をOFFにしてください。");
        }
        return;
    }

    const { data: userB, error: errB } = await supabaseB.auth.signUp({
        email: emailB,
        password: password,
        options: { data: { display_name: 'TestB', username: `test_b_${Date.now()}` } }
    });

    if (errB) {
        console.error("ユーザーBの作成に失敗しました:", errB.message);
        return;
    }

    if (!userA.session || !userB.session) {
        console.error("セッションが取得できませんでした。「Confirm email」設定がONになっている可能性があります。OFFにしてから再実行してください。");
        return;
    }

    console.log("-> ユーザーA・B 両方の作成に成功し、ログインしました！");

    console.log("2. ユーザーAが新しいグループを作成中...");
    const { data: group, error: groupErr } = await supabaseA
        .from('groups')
        .insert({ name: '予約テストグループ', created_by: userA.user.id })
        .select().single();

    if (groupErr) {
        console.error("グループ作成エラー:", groupErr);
        return;
    }

    // A自身をメンバーに追加
    await supabaseA.from('group_members').insert({ group_id: group.id, user_id: userA.user.id });

    console.log(`-> グループ「${group.name}」を作成しました (ID: ${group.id})`);

    console.log("3. ユーザーAがユーザーBをグループに招待中...");
    const { error: inviteErr } = await supabaseA
        .from('group_members')
        .insert({ group_id: group.id, user_id: userB.user.id });

    if (inviteErr) {
        console.error("招待エラー:", inviteErr);
        return;
    }
    console.log("-> ユーザーBがグループに参加しました！");

    console.log("4. ユーザーAが欲しいものアイテムを追加中...");
    const itemId = uuidv4();
    const { error: itemErr } = await supabaseA
        .from('items')
        .insert({
            id: itemId,
            user_id: userA.user.id,
            title: 'テスト用の欲しいもの',
            group_id: group.id,
            created_at: Date.now(),
            obtained: false
        });

    if (itemErr) {
        console.error("アイテム追加エラー:", itemErr);
        return;
    }
    console.log(`-> アイテムを追加しました (ID: ${itemId})`);

    console.log("5. ユーザーBがそのアイテムを「予約」中...");
    const { error: reserveErr } = await supabaseB
        .from('items')
        .update({ reserved_by: userB.user.id })
        .eq('id', itemId);

    if (reserveErr) {
        console.error("🚨 予約エラー発生 (RLSで失敗している可能性あり):", reserveErr);
        return;
    }

    const { data: checkItem } = await supabaseB.from('items').select('reserved_by').eq('id', itemId).single();

    if (checkItem && checkItem.reserved_by === userB.user.id) {
        console.log("✅ 予約成功！ユーザーBがアイテムを予約状態にできました。(被り防止達成)");
    } else {
        console.error("❌ 予約更新が反映されていません。");
        return;
    }

    console.log("=== 🎉 全ての自動テストが成功しました ===");
}

runTest();
