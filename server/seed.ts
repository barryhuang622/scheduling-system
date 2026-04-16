import pool from './db.js';

const MACHINES = [
  { id: '01', name: '幼幼平面口罩機1號機' },
  { id: '02', name: '成人立體L細耳2號機' },
  { id: '03', name: '小幼幼立體XXS細耳3號機' },
  { id: '05', name: '兒童立體S寬耳5號機' },
  { id: '06', name: '兒童立體S細耳6號機' },
  { id: '07', name: '幼幼立體XS寬耳7號機' },
  { id: '09', name: '成人立體L細耳新款9號機' },
  { id: '10', name: '幼幼立體XS細耳10號機' },
  { id: '11', name: '4D成人一般11號機' },
  { id: '12', name: '4D成人一般12號機' },
  { id: '13', name: '4D成人一般13號機' },
  { id: '15', name: '成人平面外耳帶15號機' },
  { id: '16', name: '4D成人一般16號機' },
  { id: '17', name: '4D成人一般17號機' },
  { id: '18', name: '4D成人加大18號機' },
  { id: '19', name: '4D幼幼19號機' },
  { id: '1FAI', name: '1樓視覺檢測' },
  { id: '20', name: '4D兒童20號機' },
  { id: '21', name: '4D兒童21號機' },
  { id: '22', name: '成人立體M細耳美顏22號機' },
  { id: '23', name: '成人立體L寬耳23號機' },
  { id: '25', name: '成人立體M細耳25號機' },
  { id: 'A3', name: '成人平面口罩機A3' },
  { id: 'A5', name: '成人平面口罩機A5' },
  { id: 'AGV', name: 'AGV自動倉儲' },
  { id: 'C8', name: '成人平面口罩機深色C8' },
  { id: 'G01', name: '成人平面口罩機G1' },
  { id: 'G02', name: '成人平面口罩機G2' },
  { id: 'G03', name: '成人平面口罩機G3' },
  { id: 'G05', name: '成人平面口罩機G5' },
  { id: 'G06', name: '成人平面口罩機G6' },
  { id: 'G07', name: '成人平面口罩機(定位)G7' },
  { id: 'G08', name: '成人平面口罩機(ACC專用)G8' },
  { id: 'G09', name: '成人平面口罩機G9' },
  { id: 'G10', name: '成人平面口罩機G10' },
  { id: 'G11', name: '兒童平面口罩機G11' },
  { id: 'G12', name: '兒童平面口罩機G12' },
  { id: 'G16', name: '成人平面小臉口罩機G16' },
];

const PERSONNEL = [
  { id: 'A023', name: '阮氏合' },
  { id: 'D004', name: '黃娃娣' },
  { id: 'D006', name: '阮玉愛' },
  { id: 'D010', name: '湯純真' },
  { id: 'D012', name: '陳秋紅' },
  { id: 'D013', name: '黃氏秋紅' },
  { id: 'D015', name: '莊惠玲' },
  { id: 'D016', name: '陳慧君' },
  { id: 'D019', name: '阮瀞儀' },
  { id: 'D021', name: '黃于庭' },
  { id: 'D023', name: '潘子慧' },
  { id: 'D025', name: '黎氏雪絨' },
  { id: 'D026', name: '陳氏碧玄' },
  { id: 'D031', name: '陳美鳳' },
  { id: 'D033', name: '黃金鐘' },
  { id: 'D053', name: '羅胤如' },
  { id: 'D055', name: '黃后' },
  { id: 'D068', name: '劉小莉' },
  { id: 'D080', name: '裴氏妝' },
  { id: 'D082', name: '陳采妝' },
  { id: 'D085', name: '謝氏生' },
  { id: 'D095', name: '林玉琴' },
  { id: 'D103', name: '潘素娘' },
  { id: 'D107', name: '阮嬌簪' },
  { id: 'D124', name: '黃文泰' },
  { id: 'D127', name: '林淑娟' },
  { id: 'D134', name: '德麗拉' },
  { id: 'D138', name: '玉菈' },
  { id: 'D140', name: '麥拉' },
  { id: 'D141', name: '武阮明書' },
  { id: 'D143', name: '吉曼SUJIMAN' },
  { id: 'D147', name: '武青雲' },
  { id: 'N001', name: '麗塔ARLITA' },
  { id: 'N002', name: '烏咪阿蒂RUMIATI' },
  { id: 'N009', name: '南達NANDA' },
  { id: 'N011', name: '愛迪ADE' },
  { id: 'N013', name: '以佳IKA' },
  { id: 'N014', name: '伊達ITA' },
  { id: 'N033', name: '林春美' },
  { id: 'N036', name: '范氏紅' },
  { id: 'N038', name: '功翠榮' },
  { id: 'N049', name: '鄧氏鸞' },
  { id: 'N051', name: '安多WIRANTO' },
];

export async function seed() {
  // Insert machines (skip if exist)
  for (const m of MACHINES) {
    await pool.query(
      `INSERT INTO machines (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.name]
    );
  }
  console.log(`Seeded ${MACHINES.length} machines`);

  // Insert personnel
  for (const p of PERSONNEL) {
    await pool.query(
      `INSERT INTO personnel (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name]
    );
  }
  console.log(`Seeded ${PERSONNEL.length} personnel`);

  // Insert default skills (none) for all person-machine combos
  for (const p of PERSONNEL) {
    for (const m of MACHINES) {
      await pool.query(
        `INSERT INTO skills (personnel_id, machine_id, level) VALUES ($1, $2, 'none') ON CONFLICT DO NOTHING`,
        [p.id, m.id]
      );
    }
  }
  console.log('Seeded default skills');
}
