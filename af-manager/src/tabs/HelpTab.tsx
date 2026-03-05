import { BookOpen, Database, List, Grid, Filter, Settings as SettingsIcon, Heart, Trash2, Star, ChevronRight, Package } from 'lucide-react';
import { useTranslation } from '../i18n';

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-main)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--panel-border)' }}>
            {icon} {title}
        </h3>
        {children}
    </div>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', marginBottom: '0.7rem', fontSize: 'var(--font-size-main)', lineHeight: 1.6 }}>
        <span style={{ minWidth: '1.6rem', height: '1.6rem', background: 'var(--accent-blue)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'calc(var(--font-size-sub) * 0.97)', flexShrink: 0 }}>{n}</span>
        <span style={{ color: 'var(--text-main)' }}>{children}</span>
    </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '6px', padding: '0.6rem 1rem', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginTop: '0.6rem', lineHeight: 1.6 }}>
        💡 {children}
    </div>
);

export default function HelpTab() {
    const { language } = useTranslation();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px', margin: '0 auto', paddingBottom: '3rem' }}>
            <header>
                <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <BookOpen /> {language === 'en' ? 'User Guide' : '使い方ガイド'}
                </h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                    {language === 'en' ? 'This guide explains the functions of each tab in GBF AF Manager, and the flow from data acquisition to evaluation and discard suggestions.' : 'GBF AF Manager の各タブの機能と、データ取得から評価・廃棄提案までの流れを説明します。'}
                </p>
            </header>

            {/* ── データ取得 ──────────── */}
            {/* ── データ取得 ──────────── */}
            <Section title={language === 'en' ? 'Data Acquisition Tab' : 'データ取得タブ'} icon={<Database size={18} />}>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-main)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    {language === 'en' ? 'There are 3 ways to import game Artifact (AF) data into the app.' : 'ゲームのアーティファクト（AF）データをアプリに取り込む方法は3つあります。'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'var(--dim-bg)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{language === 'en' ? '① AF Collector Extension (Send Feature)' : '① AF Collector 拡張機能（送信機能）'}</div>
                        <Step n={1}>{language === 'en' ? 'Open Granblue Fantasy in your browser and go to the Artifact List screen.' : 'グランブルーファンタジーをブラウザで開き、アーティファクト一覧画面へ移動する'}</Step>
                        <Step n={2}>{language === 'en' ? 'Click the "Start Collection" button in AF Collector and manually navigate through all pages of the AF list.' : 'AF Collectorの「収集開始」ボタンを押し、手動でAFリストを全ページ移動する'}</Step>
                        <Step n={3}>{language === 'en' ? 'After collection is complete, click the send button in AF Collector.' : '収集完了後、AF Collectorの送信ボタンを押す'}</Step>
                        <Note>{language === 'en' ? 'Cannot send to a different browser. Use the same browser or the Desktop App version.' : '別ブラウザへは送信できません。同一ブラウザかデスクトップアプリ版をご使用ください。'}</Note>
                    </div>
                    <div style={{ background: 'var(--dim-bg)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-gold)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{language === 'en' ? '② Drag & Drop File' : '② ファイルをドラッグ＆ドロップ'}</div>
                        <Step n={1}>{language === 'en' ? 'Save the JSON file using the "Download" button in AF Collector.' : 'AF Collectorの「ダウンロード」ボタンからJSONファイルを保存する'}</Step>
                        <Step n={2}>{language === 'en' ? 'Drag and drop the file into the drop zone in the Data Acquisition tab.' : 'ファイルをデータ取得タブのドロップゾーンにドラッグ＆ドロップする'}</Step>
                    </div>
                    <div style={{ background: 'var(--dim-bg)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-purple)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{language === 'en' ? '③ Paste from Developer Tools (Manual Import)' : '③ 開発者ツールから貼り付け（手動インポート）'}</div>
                        <Step n={1}>{language === 'en' ? 'Open the browser Developer Tools (F12) -> Network tab.' : 'ブラウザの開発者ツール（F12）→ネットワークタブを開く'}</Step>
                        <Step n={2}>{language === 'en' ? 'Copy the response JSON of the request to' : '<code>rest/artifact/list/1</code> へのリクエストのレスポンスJSONをコピー'} <code>rest/artifact/list/1</code></Step>
                        <Step n={3}>{language === 'en' ? 'Paste it into the manual import field at the bottom of the Data Acquisition tab -> Click "Import JSON".' : 'データ取得タブ下部の手動インポート欄に貼り付け→「JSONを取り込む」を押す'}</Step>
                        <Step n={4}>{language === 'en' ? 'Repeat for page 2 and onwards (you can paste page by page or multiple pages together).' : '2ページ目以降も同様に繰り返す（1ページずつ、または複数ページをまとめて貼り付け可）'}</Step>
                        <Note>{language === 'en' ? 'Consecutive pages starting from page 1 can be imported together. You can also import single pages independently.' : '1ページ目から連続したページであれば、まとめてインポートできます。途中ページからでも単独で取り込み可能です。'}</Note>
                    </div>
                </div>
            </Section>

            {/* ── 所持AFリスト ──────────── */}
            {/* ── 所持AFリスト ──────────── */}
            <Section title={language === 'en' ? 'AF List Tab' : '所持AFリストタブ'} icon={<List size={18} />}>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-main)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    {language === 'en' ? 'View and manage imported AF data in a list format.' : '取り込んだAFデータを一覧で確認・管理します。'}
                </p>
                <ul style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: '1.4rem', margin: 0 }}>
                    <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Filtering:' : '絞り込み:'}</strong> {language === 'en' ? 'Quickly find AFs using Element/Weapon Kind filters or keyword search.' : '属性や武器種フィルター、キーワード検索で目的のAFを素早く探せます。'}</li>
                    <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Sorting:' : 'ソート:'}</strong> {language === 'en' ? 'Click on any column header to sort the list (e.g., by Evaluation Score, alphabetical order).' : '各列のヘッダーをクリックすることで、評価スコア順や文字順等に並べ替えられます。'}</li>
                    <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Memo Function:' : 'メモ機能:'}</strong> {language === 'en' ? 'Enter and save personal notes on each row (changes are saved automatically).' : '各行には自分用のメモを入力・保存できます（内容は自動的に保存されます）。'}</li>
                </ul>
                <div style={{ marginTop: '1rem', fontSize: 'var(--font-size-main)', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Status Icon Meanings:' : 'ステータスアイコンの意味：'}</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', marginTop: '0.4rem' }}>
                        <span><Heart size={13} style={{ color: 'var(--accent-gold)' }} /> {language === 'en' ? 'Favorite (Locked in-game)' : 'お気に入り（ゲーム内でロック済み）'}</span>
                        <span><Package size={13} style={{ color: 'var(--accent-purple)' }} /> {language === 'en' ? 'Triscar (Trash in-game)' : '不用品（ゲーム内で設定済み）'}</span>
                        <span><Star size={13} style={{ color: 'var(--accent-blue)' }} /> {language === 'en' ? 'Keep Suggestion (Matches AF Keep Conditions)' : '確保提案（確保AF条件に合致）'}</span>
                        <span><Trash2 size={13} style={{ color: 'var(--accent-danger)' }} /> {language === 'en' ? 'Discard Suggestion (Judged unnecessary by evaluation score)' : '廃棄提案（評価計算の結果、不要と判断）'}</span>
                    </div>
                </div>
            </Section>

            {/* ── ゲーム内UI ──────────── */}
            {/* ── ゲーム内UI ──────────── */}
            <Section title={language === 'en' ? 'In-Game UI Tab' : 'ゲーム内UIタブ'} icon={<Grid size={18} />}>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-main)', lineHeight: 1.6 }}>
                    {language === 'en' ? 'Displays imported AFs in a grid format similar to the in-game visuals. The detail panel at the top shows information for the selected AF. Can be filtered by Element and Weapon Kind to assist with comparison and organization.' : '取り込んだAFをゲーム内の見た目に近いグリッド形式で表示します。上部の詳細パネルに選択中のAFの情報を表示します。属性・武器種でフィルタリングでき、ゲーム画面との比較と整理を補助します。'}
                </p>
                <Note>{language === 'en' ? 'Discard and Keep suggestions can be seen at a glance via badges on the cards.' : '廃棄提案・確保提案はカードのバッジでひと目で確認できます。'}</Note>
            </Section>

            {/* ── 確保AF条件 ──────────── */}
            {/* ── 確保AF条件 ──────────── */}
            <Section title={language === 'en' ? 'Keep AF Conditions Tab' : '確保AF条件タブ'} icon={<Filter size={18} />}>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-main)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    {language === 'en'
                        ? 'Register and manage conditions for flagging AFs with "Keep Suggestions". Multiple conditions can be registered, and they are evaluated in priority order from top to bottom. Once an AF claims a keep flag, it will not be evaluated in subsequent conditions.'
                        : '「確保提案」フラグを立てるための条件を登録・管理します。複数の条件を登録でき、優先度が高い（リストの上にある）条件から順に評価が行われます。一度確保フラグが立ったAFは、その後の条件判定には二重に使われません。'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.2rem' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-main)', marginBottom: '0.3rem' }}>{language === 'en' ? '1. Condition Types' : '1. 条件の指定方式'}</div>
                        <p style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Method 1: Skill Oriented' : '方法1: スキル指向'}</strong> — {language === 'en' ? 'Set the target amount of AFs you want to keep per Element × Weapon Kind matrix. Useful when securing multiple general skill combinations.' : '属性×武器種のマトリックスで「この枠のAFを何個確保したいか」を指定します。汎用的なスキル構成を複数確保したい場合に適しています。'}
                        </p>
                        <p style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Method 2: Character Oriented' : '方法2: キャラ指向'}</strong> — {language === 'en' ? 'Set "N amounts of Element/Weapon Kind" for a specific character. Useful for characters with multiple weapon proficiencies or assigning separate keep priorities.' : '特定のキャラクター用に「どの属性・武器種を何個」という形で指定します。得意武器が複数あるキャラや、専用AFの優先度を個別に設定したい場合に便利です。'}
                        </p>
                    </div>

                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-main)', marginBottom: '0.3rem' }}>{language === 'en' ? '2. Target Skills Settings' : '2. 希望スキルの設定'}</div>
                        <p style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            {language === 'en'
                                ? 'You can designate up to 4 target skills, toggling whether they "Must Match" and setting their "☆ Priority (S1-S4 for sorting skill quality)". If a skill is entered but no "☆ Priority" is set, its ☆ quality will not be compared during sorting.'
                                : '最大4つのスキルを指定し、それぞれに「必須にする」ことや「☆優先順位（S1～S4のスキル品質の比較順）」を設定できます。スキル名を入力しても優先順位を指定しない場合は、そのスキルの品質（☆の数）は評価の比較判断に使われません。'}
                        </p>
                    </div>

                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-main)', marginBottom: '0.3rem' }}>{language === 'en' ? '3. Exclude Settings' : '3. 除外設定機能'}</div>
                        <ul style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '1.4rem', margin: 0 }}>
                            <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Exclude favorited AFs:' : 'お気に入りAFを除外する:'}</strong> {language === 'en' ? 'If enabled, locked AFs in the game will be excluded from the start.' : 'チェックを入れると、ゲーム内でロック済みのAFを確保対象から除外します。'}</li>
                            <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Exclude Target Skills:' : '除外スキル設定:'}</strong> {language === 'en' ? 'Any AF possessing even one of these added skills will be forcibly excluded.' : '指定したスキルを一つでも持っているAFは、確保フラグの対象から強制的に除外されます。'}</li>
                        </ul>
                    </div>
                </div>

                {/* 確保ロジック */}
                <div style={{ background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-main)', marginBottom: '0.7rem', color: 'var(--text-main)' }}>{language === 'en' ? '📌 Keep Flag Logic Pipeline' : '📌 確保フラグの判定ロジック'}</div>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '0.6rem' }}>
                        {language === 'en' ? 'For each condition, all AFs matching the designated [Element × Weapon Kind] are evaluated and sorted in this exact order:' : '各条件において、指定した【属性×武器種】に該当する全AFに対して以下の順でふるいにかけます：'}
                    </p>
                    <ol style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: '1.4rem', margin: 0 }}>
                        <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? '1. Exclusion Check:' : '1. 除外判定:'}</strong> {language === 'en' ? 'Drops AFs that are "Favorited" (if enabled) or contain any "Excluded Skills".' : '「お気に入りAF」や「除外スキル」に該当するAFを候補から落とします。'}</li>
                        <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? '2. Target Skill Check:' : '2. 希望スキル判定:'}</strong> {language === 'en' ? 'Drops AFs that do not possess all "Must Match" skills, OR possess NONE of your designated target skills.' : '「必須」に設定したスキルを欠いているAFや、指定した希望スキル群を「1つも持っていない」AFを候補から落とします。'}</li>
                        <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? '3. Priority Sorting:' : '3. 優先度ソート:'}</strong> {language === 'en' ? 'Sorts the remaining candidates from best to worst based on:' : '候補に残ったAFを、以下の基準で優秀な順に並び替えます：'}
                            <ol type="a" style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
                                <li>{language === 'en' ? 'The amount of matched target skills (more is better)' : '条件に設定された希望スキルを多く持っているものを優先'}</li>
                                <li>{language === 'en' ? 'Higher ☆ quality of skills sorted by your "☆ Priority (1st -> 2nd...)" rankings (Skills lacking a ranking are ignored here)' : 'スキル☆優先順位（1番→2番…）に設定したスキルの☆の数が多いものを優先（※優先順位未設定の場合は比較されない）'}</li>
                                <li>{language === 'en' ? 'Higher overall evaluation score' : '評価値（スコア）が高いものを優先'}</li>
                                <li>{language === 'en' ? 'Older (earlier acquired) AFs' : '古い（先に入手した）AFを優先'}</li>
                            </ol>
                        </li>
                        <li><strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? '4. Flagging:' : '4. フラグ付与:'}</strong> {language === 'en' ? 'A keep flag is granted to the sorted candidates from top to bottom until the target count is reached.' : '並び替えた上位から順に必要な目標個数分だけ確保フラグを付与します。'}</li>
                    </ol>
                </div>

                <div style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <ChevronRight size={14} /> {language === 'en' ? 'Press "Calculate Keep Flags" to execute across all AFs.' : '「確保フラグの一括計算」ボタンを押して全AFに計算を実行します。'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ChevronRight size={14} /> {language === 'en' ? 'You can leave a memo on each condition.' : '各条件にメモを残せます（用途・注意事項など）。'}
                    </div>
                </div>
                <Note>{language === 'en' ? '"Calculate Keep Flags" can also be executed via the ⚡ button at the top of the App.' : '「確保フラグ一括計算」はApp上部の⚡ボタンからでも実行できます。'}</Note>
            </Section>

            {/* ── 設定タブ ──────────── */}
            {/* ── 設定タブ ──────────── */}
            <Section title={language === 'en' ? 'Settings Tab' : '設定タブ'} icon={<SettingsIcon size={18} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: 'var(--font-size-main)', lineHeight: 1.7 }}>
                    <div>
                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Evaluation Score Formula' : '評価スコア計算式'}</strong>
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'en' ? 'You can configure group coefficients for G1/G2/G3 skills, score values per quality level, individual skill multiplier coefficients, and adjustments for skill combinations. Clicking "Save Settings" recalculates the evaluation score of all AFs.' : 'G1/G2/G3スキルのグループ係数、品質レベル別評価値、スキル個別乗算係数、スキル組み合わせによる補正を設定できます。「設定を保存」で全AFの評価値が再計算されます。'}</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Discard Flag Settings' : '廃棄フラグ設定'}</strong>
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'en' ? 'Adjust criteria for discarding candidates (target inventory, various protection settings).' : '廃棄候補の基準（在庫目標数、各種保護設定）を調整します。'}</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Data Management / Export & Import' : 'データ管理 / エクスポート・インポート'}</strong>
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'en' ? 'You can backup all data, or selectively export/import only conditions, memos, and evaluation formulas. Be sure to export before clearing your browser cache.' : '全データのバックアップ、条件・メモ・評価計算式のみの書き出し/読み込みができます。ブラウザキャッシュクリア前には必ずエクスポートしてください。'}</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'App Design Settings' : 'アプリデザイン設定'}</strong>
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'en' ? 'You can alter zoom levels, select themes (Dark/Light), and adjust font sizes. Changes take effect immediately.' : 'ズーム率、テーマ（ダーク/ライト）、フォントサイズを変更できます。変更は即座に反映されます（保存ボタン不要）。'}</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Advanced Settings for Desktop App (Port Number)' : 'デスクトップアプリ版用上級者設定（ポート番号）'}</strong>
                        <p style={{ color: 'var(--text-muted)' }}>{language === 'en' ? 'You can change the receiving port of AF Collector for the Desktop App version. Changes require a restart.' : 'デスクトップアプリ版使用時のAF Collector受信ポートを変更できます。変更後はアプリの再起動が必要です。'}</p>
                    </div>
                </div>
            </Section>

            {/* ── よくある質問 ──────────── */}
            {/* ── よくある質問 ──────────── */}
            <Section title={language === 'en' ? 'Frequently Asked Questions' : 'よくある質問'} icon={<BookOpen size={18} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--font-size-main)' }}>
                    {[
                        {
                            q: language === 'en' ? 'My data has disappeared' : 'データが消えた',
                            a: language === 'en' ? 'This app saves your data using the browser\'s IndexedDB (local storage). Ensure you are using the exact same browser as before. Clearing browser cache or site data will erase this data. Please periodically use "Export Data" to backup your database. This also applies to the Desktop App version.' : '本アプリはブラウザのIndexedDB（ローカルストレージ）にデータを保存しています。前回使用したブラウザと同一ブラウザか確かめてください。また、ブラウザのキャッシュ・サイトデータをクリアするとデータが消えます。定期的に「データをエクスポート」でバックアップしてください。デスクトップアプリ版でも同様です。'
                        },
                        {
                            q: language === 'en' ? 'AF Collector cannot collect' : 'AF Collectorで収集できない',
                            a: language === 'en' ? 'Reload the page once, navigate back to the Artifact list and try collecting again. It is okay to navigate multiple pages while collecting.' : '一度リロードを行ったのち、アーティファクト一覧画面へ移動してから収集開始してみてください。収集中は同じページを横断しても問題ありません。'
                        },
                        {
                            q: language === 'en' ? 'Extension data is not reaching the app' : '拡張機能のデータがアプリに届かない',
                            a: language === 'en' ? 'It is only possible to send it to the GBF AF Manager tab opened within the same browser. If you don\'t want to open it in the same browser, use the Desktop App version (the app must be running to receive data).' : '同一ブラウザで開いているGBF AF Manager タブへのみ送信が可能です。同一ブラウザで開きたくない場合はデスクトップアプリ版をご使用ください（送信はアプリが起動中である必要があります）。'
                        },
                        {
                            q: language === 'en' ? 'Evaluation scores are unexpected' : '評価スコアが想定と違う',
                            a: language === 'en' ? 'Check your individual skill multipliers, group coefficients, and quality level scores in the Settings tab. Pressing "Save Settings" will recalculate the score across all AFs.' : '設定タブのスキル個別乗算係数・グループ係数・品質レベル別評価値を確認してください。「設定を保存」を押すと全AFの評価値が再計算されます。'
                        },
                    ].map(({ q, a }) => (
                        <details key={q} style={{ background: 'var(--dim-bg)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.5 }}>Q: {q}</summary>
                            <p style={{ marginTop: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{a}</p>
                        </details>
                    ))}
                </div>
            </Section>
        </div>
    );
}
