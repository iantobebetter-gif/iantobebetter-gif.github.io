-- --------------------------------------------------------
-- 1. 重置数据库（清空现有数据）
-- --------------------------------------------------------
USE lottery_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE users;
TRUNCATE TABLE config;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- 2. 初始化配置
-- 圆桌数量: 4
-- 每桌座位: 11 
-- --------------------------------------------------------
INSERT INTO config (id, table_count, seats_per_table) VALUES (1, 4, 11);

-- --------------------------------------------------------
-- 3. 导入人员名单
-- --------------------------------------------------------

-- ====================
-- 🦁 领导组 (4人)
-- ====================
INSERT INTO users (name, group_name, role) VALUES 
('王总', '领导组', 'leader'),
('卢总', '领导组', 'leader'),
('寿总', '领导组', 'leader'),
('黄总', '领导组', 'leader');


-- ====================
-- 🐴 二团 (14人)
-- ====================
INSERT INTO users (name, group_name, role) VALUES 
('倪丹', '二团', 'employee'),
('鲁栋栋', '二团', 'employee'),
('吴斐斐', '二团', 'employee'),
('宋柯佳', '二团', 'employee'),
('周华康', '二团', 'employee'),
('张健', '二团', 'employee'),
('周楚明', '二团', 'employee'),
('李永富', '二团', 'employee'),
('厉阳', '二团', 'employee'),
('张伟', '二团', 'employee'),
('龙志文', '二团', 'employee'),
('栾明学', '二团', 'employee'),
('康怿涵', '二团', 'employee'),
('闫胜元', '二团', 'employee');


-- ====================
-- 🐴 四团 (13人)
-- ====================
INSERT INTO users (name, group_name, role) VALUES 
('潘琰', '四团', 'employee'),
('孔祥福', '四团', 'employee'),
('陈骏宇', '四团', 'employee'),
('傅承雄', '四团', 'employee'),
('何林飞', '四团', 'employee'),
('宋荣', '四团', 'employee'),
('李泽州', '四团', 'employee'),
('郑力玮', '四团', 'employee'),
('贺思', '四团', 'employee'),
('徐俊超', '四团', 'employee'),
('王宇涵', '四团', 'employee'),
('董银燕', '四团', 'employee'),
('许忆恩', '四团', 'employee');

-- ====================
-- 🐴 五团 (9人)
-- ====================
INSERT INTO users (name, group_name, role) VALUES 
('李杰', '五团', 'employee'),
('罗进珮', '五团', 'employee'),
('高燕煦', '五团', 'employee'),
('金戈愉', '五团', 'employee'),
('许楷文', '五团', 'employee'),
('刘景力', '五团', 'employee'),
('汪新涛', '五团', 'employee'),
('李乐天', '五团', 'employee'),
('马奕骏', '五团', 'employee');

-- ====================
-- 🐴 特邀嘉宾 (4人)
-- ====================
INSERT INTO users (name, group_name, role) VALUES 
('叶剑', '特邀嘉宾', 'employee'),
('郭凡玉', '特邀嘉宾', 'employee'),
('孔冷', '特邀嘉宾', 'employee'),
('陈峰', '特邀嘉宾', 'employee');

-- --------------------------------------------------------
-- 查询验证
-- --------------------------------------------------------
SELECT group_name, COUNT(*) as count FROM users GROUP BY group_name;
