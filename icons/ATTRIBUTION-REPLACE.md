# icons/classes 与 icons/species 同路径替换件署名（CC BY 3.0）

本文件记录 ArcaneDesk 同路径替换件的 CC BY 3.0 署名，生成器 tools/build-class-species-icons.mjs
（该生成器留在父仓，不进 fork）。

上游分发包内的 `icons/classes/`（24 枚 512×512）与 `icons/species/`（14 枚 256×256）在包内
`icons/LICENSE` 未枚举、无独立许可声明。本 fork 以同路径替换件覆盖：保名保尺寸，packs 引用零改动。
工艺：白图形（game-icons.net）+ 自绘底板（色相取自原图主导色、压暗到白图形可读区间），不透明 webp。

<!-- mt-icons:classes-species:start -->
## 追加：dnd5e icons/{classes,species} 同路径替换（38 枚，2026-10-19）

上游分发包内的 `packages/dnd5e/icons/classes/`（24 枚 512×512）与 `icons/species/`（14 枚 256×256）
在包内 icons/LICENSE 未枚举、无独立许可声明（审计红10）——**同路径替换**（保名保尺寸，packs 引用零改动）。
工艺：白图形（game-icons.net）+ 自绘底板（色相取自原图主导色、压暗到白图形可读区间），
不透明 webp，尺寸对齐原图。生成 `tools/build-class-species-icons.mjs`，选型 `asset-pack/icons/{classes,species}/selection.json`。

逐枚署名（`目标文件` ← 图标名 by 作者）：
    dnd5e/icons/classes/barbarian.webp ← Battle Axe by lorc，CC BY 3.0，game-icons.net（野蛮人（战斧））
    dnd5e/icons/classes/bard.webp ← Harp by delapouite，CC BY 3.0，game-icons.net（吟游诗人（竖琴））
    dnd5e/icons/classes/berserker.webp ← Crossed Axes by lorc，CC BY 3.0，game-icons.net（狂战士（交叉双斧））
    dnd5e/icons/classes/champion.webp ← Laurel Crown by lorc，CC BY 3.0，game-icons.net（勇士（桂冠））
    dnd5e/icons/classes/cleric.webp ← Sunbeams by lorc，CC BY 3.0，game-icons.net（牧师（圣光辉耀））
    dnd5e/icons/classes/devotion.webp ← Angel Wings by lorc，CC BY 3.0，game-icons.net（奉献誓言（天界之翼））
    dnd5e/icons/classes/draconic.webp ← Dragon Head by lorc，CC BY 3.0，game-icons.net（龙裔血脉（龙首））
    dnd5e/icons/classes/druid.webp ← Paw Print by lorc，CC BY 3.0，game-icons.net（德鲁伊（兽爪））
    dnd5e/icons/classes/evoker.webp ← Bright Explosion by lorc，CC BY 3.0，game-icons.net（塑能师（爆裂））
    dnd5e/icons/classes/fiend.webp ← Devil Mask by delapouite，CC BY 3.0，game-icons.net（邪魔宗主（恶魔面具））
    dnd5e/icons/classes/fighter.webp ← Crossed Swords by lorc，CC BY 3.0，game-icons.net（战士（交叉长剑））
    dnd5e/icons/classes/hunter.webp ← Target Arrows by lorc，CC BY 3.0，game-icons.net（猎手（箭中靶心））
    dnd5e/icons/classes/land.webp ← Paw Print by lorc，CC BY 3.0，game-icons.net（大地结社（兽爪，与 druid 共图，照原图族））
    dnd5e/icons/classes/life.webp ← Healing by delapouite，CC BY 3.0，game-icons.net（生命领域（治疗））
    dnd5e/icons/classes/lore.webp ← Open Book by lorc，CC BY 3.0，game-icons.net（博识学院（摊开的书卷））
    dnd5e/icons/classes/monk.webp ← Magic Palm by lorc，CC BY 3.0，game-icons.net（武僧（运气掌））
    dnd5e/icons/classes/open-hand.webp ← Open Palm by skoll，CC BY 3.0，game-icons.net（开手宗（张开的手））
    dnd5e/icons/classes/paladin.webp ← Winged Shield by lorc，CC BY 3.0，game-icons.net（圣武士（翼盾））
    dnd5e/icons/classes/ranger.webp ← Pocket Bow by lorc，CC BY 3.0，game-icons.net（游侠（弓））
    dnd5e/icons/classes/rogue.webp ← Shuriken by lorc，CC BY 3.0，game-icons.net（游荡者（手里剑））
    dnd5e/icons/classes/sorcerer.webp ← Flame by carl-olsen，CC BY 3.0，game-icons.net（术士（火焰））
    dnd5e/icons/classes/thief.webp ← Unlocking by lorc，CC BY 3.0，game-icons.net（盗贼（开锁））
    dnd5e/icons/classes/warlock.webp ← Eye Shield by lorc，CC BY 3.0，game-icons.net（邪术师（魔眼之盾））
    dnd5e/icons/classes/wizard.webp ← Crystal Wand by lorc，CC BY 3.0，game-icons.net（法师（水晶杖））
    dnd5e/icons/species/dragonborn.webp ← Spiked Dragon Head by delapouite，CC BY 3.0，game-icons.net（龙裔（棘刺龙首））
    dnd5e/icons/species/drow.webp ← Hooded Figure by darkzaitzev，CC BY 3.0，game-icons.net（卓尔（兜帽暗影剪影））
    dnd5e/icons/species/dwarf.webp ← Dwarf Face by delapouite，CC BY 3.0，game-icons.net（矮人（矮人面庞））
    dnd5e/icons/species/elf-high.webp ← Woman Elf Face by delapouite，CC BY 3.0，game-icons.net（高等精灵（精灵面庞））
    dnd5e/icons/species/elf-wood.webp ← Linden Leaf by lorc，CC BY 3.0，game-icons.net（木精灵（椴叶））
    dnd5e/icons/species/gnome-forest.webp ← Bad Gnome by cathelineau，CC BY 3.0，game-icons.net（森林侏儒（侏儒像））
    dnd5e/icons/species/gnome-rock.webp ← Steampunk Goggles by delapouite，CC BY 3.0，game-icons.net（岩石侏儒（工匠护目镜））
    dnd5e/icons/species/goliath.webp ← Giant by delapouite，CC BY 3.0，game-icons.net（歌利亚（巨人像））
    dnd5e/icons/species/halfling.webp ← Barefoot by lorc，CC BY 3.0，game-icons.net（半身人（赤足））
    dnd5e/icons/species/human.webp ← Person by delapouite，CC BY 3.0，game-icons.net（人类（人形））
    dnd5e/icons/species/orc.webp ← Orc Head by delapouite，CC BY 3.0，game-icons.net（兽人（兽人首））
    dnd5e/icons/species/tiefling-abyssal.webp ← Daemon Skull by lorc，CC BY 3.0，game-icons.net（深渊提夫林（魔族颅骨））
    dnd5e/icons/species/tiefling-chthonic.webp ← Horned Reptile by delapouite，CC BY 3.0，game-icons.net（冥府提夫林（有角爬虫））
    dnd5e/icons/species/tiefling-infernal.webp ← Horned Skull by lorc，CC BY 3.0，game-icons.net（炼狱提夫林（带角颅骨））

作者覆盖（6 人）：carl-olsen / cathelineau / darkzaitzev / delapouite / lorc / skoll。
完整许可文本：https://creativecommons.org/licenses/by/3.0/
<!-- mt-icons:classes-species:end -->
