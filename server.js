const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // Add path module
const ExcelJS = require('exceljs'); // Add exceljs
const { pool, initDB } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); 

// Initialize DB on startup
initDB().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Failed to init DB:', err);
});

// Helper: Get random item
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const fourBless = [
  "马到成功", "龙马精神", "一马当先", "万马奔腾", "马上发财", "马上有钱", "马运亨通", "马势如虹",
  "骏马奔腾", "天马行空", "事业腾飞", "步步高升", "金玉满堂", "财源广进", "喜气洋洋", "鸿运当头",
  "吉星高照", "鹏程万里", "大展宏图", "诸事顺利", "心想事成", "一帆风顺", "蒸蒸日上", "锦上添花",
  "福星高照", "恭喜发财", "阖家幸福", "顺心如意", "春风得意", "祥瑞满堂", "紫气东来", "六六大顺",
  "八方来财", "招财进宝", "日进斗金", "腰缠万贯", "富贵吉祥", "开工大吉", "大吉大利", "万事如意",
  "岁岁平安", "五福临门", "三阳开泰", "喜从天降", "好运连连", "笑口常开", "福寿安康", "平平安安",
  "团团圆圆", "幸福美满", "福禄双全", "财运亨通", "飞黄腾达", "前程似锦", "功成名就", "一鸣惊人",
  "才高八斗", "学富五车", "聪明伶俐", "机智过人"
];

// 1. Get Config & Init State
app.get('/api/init', async (req, res) => {
  try {
    const [configRows] = await pool.query('SELECT * FROM config WHERE id = 1');
    const [users] = await pool.query('SELECT * FROM users');
    
    // Process tables
    const config = configRows[0];
    const tableCount = config.table_count;
    const seatsPerTable = config.seats_per_table;
    
    // Reconstruct table state
    const tables = Array.from({ length: tableCount }, (_, i) => ({
      id: i + 1,
      seats: Array.from({ length: seatsPerTable }, () => ({ used: false })),
      leaders: 0,
      employees: 0
    }));

    users.forEach(u => {
      if (u.is_signed_in && u.table_number) {
        const tIdx = u.table_number - 1;
        const sIdx = u.seat_number - 1;
        if (tables[tIdx] && tables[tIdx].seats[sIdx]) {
          tables[tIdx].seats[sIdx] = {
            used: true,
            label: u.seat_label,
            role: u.role,
            name: u.name,
            group: u.group_name,
            lottery_number: u.lottery_number
          };
          if (u.role === 'leader') tables[tIdx].leaders++;
          else tables[tIdx].employees++;
        }
      }
    });

    res.json({
      config,
      tables,
      stats: {
        total: users.length,
        signedIn: users.filter(u => u.is_signed_in).length,
        remaining: users.filter(u => !u.is_signed_in).length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Roster Tree
app.get('/api/roster', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT name, group_name, role FROM users WHERE is_signed_in = FALSE ORDER BY group_name, name');
    
    // Custom sort for Leaders
    const leaderOrder = ["王学军", "卢昭泉", "寿砚耕", "黄卓慧"];
    const leaders = users.filter(u => u.role === 'leader').sort((a, b) => {
      const idxA = leaderOrder.indexOf(a.name);
      const idxB = leaderOrder.indexOf(b.name);
      // If not found in list, put at end
      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;
      return valA - valB;
    });

    // Build Tree
    const tree = {
      leaders: leaders,
      groups: {}
    };

    // Custom sort for Guests (孔、陈、叶、郭)
    const guestOrder = ["孔冷", "陈峰", "叶剑", "郭凡玉"];

    users.filter(u => u.role === 'employee').forEach(u => {
      if (!tree.groups[u.group_name]) {
        tree.groups[u.group_name] = [];
      }
      tree.groups[u.group_name].push(u);
    });

    // Reorder groups: Special Guests -> Group 2 -> Group 4 -> Group 5
    // But object keys order is not guaranteed in JSON.
    // Frontend should handle display order.
    // But we can try to return an ordered structure if frontend iterates keys.
    // Actually, tree.groups is an object.
    
    // Let's sort guests inside the group first
    if (tree.groups['特邀嘉宾']) {
      tree.groups['特邀嘉宾'].sort((a, b) => {
        const idxA = guestOrder.indexOf(a.name);
        const idxB = guestOrder.indexOf(b.name);
        const valA = idxA === -1 ? 999 : idxA;
        const valB = idxB === -1 ? 999 : idxB;
        return valA - valB;
      });
    }

    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Sign In
app.post('/api/signin', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  try {
    // Check user
    const [rows] = await pool.query('SELECT * FROM users WHERE name = ?', [name]);
    if (rows.length === 0) return res.status(404).json({ error: '未找到该人员，请检查姓名是否正确' });
    
    const user = rows[0];
    if (user.is_signed_in) return res.status(400).json({ error: '该人员已签到' });

    // Allocation Logic
    const [configRows] = await pool.query('SELECT * FROM config WHERE id = 1');
    const config = configRows[0];
    
    // Get current table status
    // Note: This is a simple implementation. For high concurrency, use transactions/locking.
    // Here we just re-calculate from DB to be safe-ish.
    const [allUsers] = await pool.query('SELECT * FROM users WHERE is_signed_in = TRUE');
    
    // Build simplified tables state to find empty seat
    const tables = Array.from({ length: config.table_count }, (_, i) => ({
      index: i,
      id: i + 1,
      leaders: 0,
      employees: 0,
      total: 0,
      seats: new Array(config.seats_per_table).fill(false) // false = empty
    }));

    allUsers.forEach(u => {
      if (u.table_number) {
        const t = tables[u.table_number - 1];
        if (t) {
          t.total++;
          if (u.role === 'leader') t.leaders++; else t.employees++;
          if (u.seat_number) t.seats[u.seat_number - 1] = true;
        }
      }
    });

    // Strategy: Balanced Filling
    const candidates = tables.filter(t => t.total < config.seats_per_table);
    if (candidates.length === 0) return res.status(400).json({ error: '所有座位已满' });

    let targetTableIndex = -1;
    let targetSeatIndex = -1;
    
    if (user.role === 'leader') {
      // Leader Rule:
      // Wang, Lu, Shou, Huang MUST be separated into different tables.
      // They should occupy Seat 1 of Table 1, 2, 3, 4 respectively (or randomly among available tables).
      
      const fixedLeaders = ["王学军", "卢昭泉", "寿砚耕", "黄卓慧"];
      
      if (fixedLeaders.includes(user.name)) {
         // Check which tables already have a "fixed leader"
         // We can check seat 1 of each table, assuming fixed leaders take seat 1.
         // Or better, check the names in tables.
         
         const occupiedTableIds = new Set();
         
         // Helper to check if a table has one of the fixed leaders
         tables.forEach(t => {
            const seat1 = t.seats[0]; // Assume leaders take seat 1
            if (seat1 && seat1.used && fixedLeaders.includes(seat1.name)) {
               occupiedTableIds.add(t.id);
            }
         });

         // Find tables that DON'T have a fixed leader yet
         // (and where Seat 1 is empty, just to be safe, though logic implies it should be)
         const availableTables = tables.filter(t => !occupiedTableIds.has(t.id) && !t.seats[0]);
         
         if (availableTables.length === 0) {
            return res.status(400).json({ error: '四大领导席位已满，无法分配互斥座位' });
         }

         // Special case: Wang prefers Table 1 if available?
         // User didn't strictly say Wang must be Table 1, just "mutually exclusive".
         // But usually Wang is Table 1. Let's try to assign Wang to Table 1 if available.
         
         if (user.name === '王学军') {
            const t1 = availableTables.find(t => t.id === 1);
            if (t1) {
               targetTableIndex = t1.index;
               targetSeatIndex = 0;
            } else {
               // Table 1 taken or not available?
               // If Table 1 is taken by another fixed leader, Wang cannot sit there.
               // If Wang MUST be Table 1, we should have reserved it.
               // Assuming logic: First come first serve, or Wang signs in first?
               // Let's just pick random available for mutual exclusion.
               const chosen = getRandomItem(availableTables);
               targetTableIndex = chosen.index;
               targetSeatIndex = 0;
            }
         } else {
             // Other 3 leaders: Pick any available table from the remaining set
             const chosen = getRandomItem(availableTables);
             targetTableIndex = chosen.index;
             targetSeatIndex = 0;
         }
      } else {
         // Remaining 2 leaders (or others) -> Random tables
         // They can sit at any table, preferably Seat 1 if empty?
         // If all Seat 1s are taken by fixed leaders (4 tables, 4 fixed leaders),
         // then these extra leaders must take other seats?
         // Or maybe there are more than 4 tables? Config says table_count = 4.
         // So 4 tables, 4 fixed leaders take all Seat 1s.
         // Remaining leaders must take normal seats?
         // User says "remaining 2 leaders can randomly distribute".
         // Let's treat them as employees for seat allocation (random empty seat),
         // BUT they are still leaders in role.
         
         // Try to find a random table with ANY empty seat (avoiding Seat 1 if we want to reserve it, 
         // but if Seat 1 is taken by fixed leaders, we just find any empty).
         
         const candidates = tables.filter(t => t.total < config.seats_per_table);
         if (candidates.length === 0) return res.status(400).json({ error: '座位已满' });
         
         const chosenTable = getRandomItem(candidates);
         targetTableIndex = chosenTable.index;
         
         // Find first empty seat. 
         // If Seat 1 is empty (e.g. fixed leader hasn't signed in yet), should they take it?
         // Better NOT take Seat 1 to reserve it for fixed leaders.
         // So search from index 1.
         const t = tables[targetTableIndex];
         targetSeatIndex = t.seats.findIndex((used, idx) => !used && idx > 0);
         
         if (targetSeatIndex === -1) {
             // Only Seat 1 is left?
             if (!t.seats[0]) {
                 // Dangerous: Taking Seat 1 might block fixed leader.
                 // But if we are full, maybe okay?
                 // Let's block Seat 1 for safety unless explicit.
                 return res.status(400).json({ error: '该桌仅剩主位（保留给特定领导），请重试或联系管理员' });
             }
         }
      }
    } else {
      // Employees: Avoid Seat #1
      const validTables = candidates.filter(t => {
         // Check if table has empty seats other than seat #1
         const hasFreeNormalSeat = t.seats.slice(1).some(s => !s);
         return hasFreeNormalSeat;
      });
      
      if (validTables.length === 0) return res.status(400).json({ error: '员工座位已满' });

      const minEmps = Math.min(...validTables.map(c => c.employees));
      const step1 = validTables.filter(c => c.employees === minEmps);
      const minTotal = Math.min(...step1.map(c => c.total));
      const step2 = step1.filter(c => c.total === minTotal);
      targetTableIndex = getRandomItem(step2).index;
      
      // Find first empty seat starting from index 1 (Seat 2)
      const t = tables[targetTableIndex];
      targetSeatIndex = t.seats.findIndex((used, idx) => !used && idx > 0);
    }

    const targetTable = tables[targetTableIndex];
    // const seatIndex = targetTable.seats.findIndex(s => !s); // Removed old logic
    const seatIndex = targetSeatIndex;
    
    if (seatIndex === -1) return res.status(500).json({ error: 'Logic Error: Seat allocation failed' });

    // Predefined Lucky Numbers Pool (Enumerated as requested)
    // Focus on 6, 8, and auspicious combinations like 168, 518, etc.
    const luckyPool = [
      "168", "188", "158", "198", "166", "186",
      "268", "288", "258", "298", "266", "286",
      "368", "388", "358", "398", "366", "386",
      "518", "568", "588", "598", "566", "586",
      "618", "666", "668", "688", "698", "658",
      "718", "768", "788", "798", "766", "786",
      "818", "868", "888", "898", "858", "866",
      "918", "968", "988", "998", "966", "986",
      "1688", "1888", "5188", "6666", "8888", "9999",
      "1168", "1188", "6688", "8866", "1368", "1388"
    ];

    // Get already assigned numbers
    const [usedRows] = await pool.query('SELECT lottery_number FROM users WHERE lottery_number IS NOT NULL');
    const usedNumbers = new Set(usedRows.map(r => r.lottery_number));

    // Filter available
    let available = luckyPool.filter(n => !usedNumbers.has(n));

    // Fallback if pool is empty (generate random lucky number)
    if (available.length === 0) {
        const generateLuckyNumber = () => {
          const luckyDigits = [0, 6, 8, 9];
          const firstDigits = [1, 6, 8];
          let numStr = '' + firstDigits[Math.floor(Math.random() * firstDigits.length)];
          for(let i=0; i<2; i++) numStr += luckyDigits[Math.floor(Math.random() * luckyDigits.length)];
          return numStr;
        };
        let newNum = generateLuckyNumber();
        while(usedNumbers.has(newNum)) {
           newNum = generateLuckyNumber();
        }
        available = [newNum];
    }

    const lotteryNum = getRandomItem(available);
    const label = getRandomItem(fourBless);

    // Update DB
    await pool.query(
      'UPDATE users SET is_signed_in = TRUE, table_number = ?, seat_number = ?, lottery_number = ?, seat_label = ? WHERE id = ?',
      [targetTable.id, seatIndex + 1, lotteryNum, label, user.id]
    );

    res.json({
      ok: true,
      data: {
        name: user.name,
        role: user.role,
        group: user.group_name,
        tableId: targetTable.id,
        seatId: seatIndex + 1,
        lotteryNumber: lotteryNum,
        label
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Reset All (Default)
app.post('/api/reset', async (req, res) => {
  try {
    // Reset everything: sign-in status, seat assignment, AND prizes
    await pool.query('UPDATE users SET is_signed_in = FALSE, table_number = NULL, seat_number = NULL, lottery_number = NULL, seat_label = NULL, prize_level = NULL');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Reset Sign-in Only
app.post('/api/reset/signin', async (req, res) => {
  try {
    // Only reset sign-in and seat info. Keep prize_level? No, if sign-in is gone, they shouldn't have prizes usually.
    // But request says "清空签到数据，座位分配".
    // Usually a full reset is safer, but let's assume they want to re-do seating without clearing prize history? 
    // Or maybe they want to clear sign-in/seating specifically.
    // However, if we clear sign-in, they fall out of "candidates" for lottery anyway.
    
    // Let's implement exactly as asked: Clear sign-in, table, seat, lottery_number, seat_label.
    // Note: If they have a prize, and we clear sign-in, they might still show up in winners list if we don't clear prize_level.
    // But winners list query checks "prize_level IS NOT NULL". It doesn't enforce "is_signed_in".
    // So this allows re-signing in people who already won?
    // Let's just clear sign-in related fields.
    
    await pool.query('UPDATE users SET is_signed_in = FALSE, table_number = NULL, seat_number = NULL, lottery_number = NULL, seat_label = NULL');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Reset Lottery Only
app.post('/api/reset/lottery', async (req, res) => {
  try {
    // Only clear prize_level
    await pool.query('UPDATE users SET prize_level = NULL');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Manual Update User Info
app.post('/api/admin/update_user', async (req, res) => {
  const { name, table_number, seat_number, lottery_number } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  try {
    // Check if user exists
    const [rows] = await pool.query('SELECT * FROM users WHERE name = ?', [name]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    // Update fields if provided
    let updateFields = [];
    let params = [];

    if (table_number !== undefined && table_number !== '') {
       updateFields.push('table_number = ?');
       params.push(table_number);
    }

    if (seat_number !== undefined && seat_number !== '') {
       updateFields.push('seat_number = ?');
       params.push(seat_number);
    }

    if (lottery_number !== undefined && lottery_number !== '') {
       updateFields.push('lottery_number = ?');
       params.push(lottery_number);
    }
    
    if (updateFields.length > 0) {
       // Force sign in if manually setting data
       updateFields.push('is_signed_in = TRUE');
       
       // Auto-generate seat_label if not provided
       const fourBless = [
          "马到成功", "龙马精神", "一马当先", "万马奔腾", "马上发财", "马上有钱", "马运亨通", "马势如虹",
          "骏马奔腾", "天马行空", "事业腾飞", "步步高升", "金玉满堂", "财源广进", "喜气洋洋", "鸿运当头",
          "吉星高照", "鹏程万里", "大展宏图", "诸事顺利", "心想事成", "一帆风顺", "蒸蒸日上", "锦上添花",
          "福星高照", "恭喜发财", "阖家幸福", "顺心如意", "春风得意", "祥瑞满堂", "紫气东来", "六六大顺",
          "八方来财", "招财进宝", "日进斗金", "腰缠万贯", "富贵吉祥", "开工大吉", "大吉大利", "万事如意",
          "岁岁平安", "五福临门", "三阳开泰", "喜从天降", "好运连连", "笑口常开", "福寿安康", "平平安安",
          "团团圆圆", "幸福美满", "福禄双全", "财运亨通", "飞黄腾达", "前程似锦", "功成名就", "一鸣惊人",
          "才高八斗", "学富五车", "聪明伶俐", "机智过人"
        ];
       const label = fourBless[Math.floor(Math.random() * fourBless.length)];
       updateFields.push('seat_label = ?');
       params.push(label);

       const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE name = ?`;
       params.push(name);
       
       await pool.query(sql, params);
       
       // Auto-assign seat only if table is set but seat is NOT provided and NOT already set
       if (table_number && !seat_number && (!rows[0].seat_number)) {
          // Find an empty seat in that table
          const [tableUsers] = await pool.query('SELECT seat_number FROM users WHERE table_number = ? AND seat_number IS NOT NULL', [table_number]);
          const usedSeats = new Set(tableUsers.map(u => u.seat_number));
          
          // Assuming max 12 seats just to be safe
          let newSeat = 1;
          while (usedSeats.has(newSeat)) {
             newSeat++;
          }
          // Update seat_number
          await pool.query('UPDATE users SET seat_number = ? WHERE name = ?', [newSeat, name]);
       }

       res.json({ ok: true, message: `User ${name} updated` });
    } else {
       res.json({ ok: true, message: 'No changes made' });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Get All Users Info (Admin)
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, group_name, role, is_signed_in, table_number, seat_number, lottery_number, seat_label, prize_level FROM users ORDER BY is_signed_in DESC, table_number ASC, seat_number ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// Export API
// ------------------------------------------------------------
app.get('/api/export/excel', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT lottery_number as uid, name, group_name as department, seat_label as identity FROM users WHERE is_signed_in = TRUE');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('签到名单');

    worksheet.columns = [
      { header: 'uid', key: 'uid', width: 15 },
      { header: 'name', key: 'name', width: 15 },
      { header: 'avatar', key: 'avatar', width: 10 },
      { header: 'department', key: 'department', width: 20 },
      { header: 'identity', key: 'identity', width: 25 },
    ];

    users.forEach(u => {
      worksheet.addRow({
        uid: u.uid || '',
        name: u.name,
        avatar: '', // Empty as requested, or placeholder
        department: u.department,
        identity: u.identity || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Export failed');
  }
});

// ------------------------------------------------------------
// Lottery APIs
// ------------------------------------------------------------

// Get candidates (signed in but no prize)
app.get('/api/lottery/candidates', async (req, res) => {
  try {
    // Candidates must be signed in AND have no prize yet
    const [rows] = await pool.query('SELECT id, name, group_name, role, lottery_number FROM users WHERE is_signed_in = TRUE AND prize_level IS NULL');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Draw winners
app.post('/api/lottery/draw', async (req, res) => {
  const { level, count } = req.body;
  // level: '一等奖', '二等奖', '三等奖'
  // count: number to draw
  
  if (!level || !count || count <= 0) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // 1. Get candidates again to be safe
    // Include lottery_number in the selection
    const [candidates] = await pool.query('SELECT id, name, group_name, lottery_number FROM users WHERE is_signed_in = TRUE AND prize_level IS NULL');
    
    if (candidates.length < count) {
      return res.status(400).json({ error: `奖池人数不足！当前仅剩 ${candidates.length} 人，无法抽取 ${count} 人` });
    }

    // 2. Randomize
    const winners = [];
    const tempCandidates = [...candidates];
    
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * tempCandidates.length);
      winners.push(tempCandidates[idx]);
      tempCandidates.splice(idx, 1); // Remove used
    }

    // 3. Update DB
    if (winners.length > 0) {
      const ids = winners.map(w => w.id);
      await pool.query('UPDATE users SET prize_level = ? WHERE id IN (?)', [level, ids]);
    }

    res.json({ winners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all winners
app.get('/api/lottery/winners', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, prize_level FROM users WHERE prize_level IS NOT NULL ORDER BY FIELD(prize_level, "一等奖", "二等奖", "三等奖")');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Lottery (Admin)
app.post('/api/lottery/reset', async (req, res) => {
  try {
    await pool.query('UPDATE users SET prize_level = NULL');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
