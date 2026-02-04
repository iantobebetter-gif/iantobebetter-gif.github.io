-- 更新领导组姓名
UPDATE users SET name = '王学军' WHERE name = '王总';
UPDATE users SET name = '卢昭泉' WHERE name = '卢总';
UPDATE users SET name = '寿砚耕' WHERE name = '寿总';
UPDATE users SET name = '黄卓慧' WHERE name = '黄总';

-- 检查更新结果
SELECT id, name, role FROM users WHERE role = 'leader';
