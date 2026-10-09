# 美少女单位概念板生成记录

日期：2026-10-09。用途：用户反馈 FB-20261009-002 的美术方向评审。采用内置 image_gen，不接入当前游戏。

本次为一张三单位全身概念板：IF-09 前哨、MB-03 棱镜、AM-17 浪锋。均采用成年女性外形的机装少女，分别展示轻步兵、主战装甲和两栖登陆特征。单位名称是型号代号，图像是型号代表，不表示唯一剧情角色。

## 最终提示词

```text
Use case: stylized-concept
Asset type: original anime strategy game unit character concept plate, three full-body character illustrations for art direction review.
Primary request: Redesign infantry, main battle tank, and marine units into beautiful female anthropomorphic mechanized combat characters for the original game "Six Realms". The game is being reimagined as a fictional world of adult female synthetic "mecha maidens", each with detachable role-specific combat rigs. Create an exquisite high-end anime mobile-game illustration aesthetic, wholly original characters and outfits, no copying any existing IP. Beauty, attractive memorable character faces, refined costumes and role clarity are primary.
Composition: a polished wide three-column character design plate, three distinct adult women aged at least 25, full figures including weapons, rigs, boots and hair fully visible, generous space between figures, equal prominence. Light ivory studio background, subtle technical framing, restrained teal details, no scenery, no extra people. Crisp masterful linework, detailed soft painted cel shading, subtle materials, elegant feminine proportions.
LEFT / IF-09 INFANTRY: beautiful alert brunette with short chestnut bob and green eyes, warm self-assured expression, asymmetrical white-gray cropped field jacket with teal ring insignia, tasteful layered pleated skirt over dark armored leggings, boots, rifle held in a relaxed ready position, compact square backpack, small circular radio earpiece. Light agile straight vertical silhouette, practical elegance, no massive mechanical frame. Represents the low-cost guard-and-capture infantry.
CENTER / MB-03 MAIN BATTLE TANK: beautiful composed woman with long silver hair and cool green eyes, layered black and white fitted combat dress with faceted diamond-shaped breastplate, teal luminous seams only on equipment indicators. Medium-weight symmetrical armor rig around hips and calves with clearly visible small tread modules, articulated backpack supports one medium-long tank cannon projecting to her right and angled slightly down, a readable diamond turret motif. Stable poised stance, graceful face and hands unobscured, no handheld sword, no dual guns, no oversized heavy-tank shield. Represents balanced armor, advancing main battle tank and armor-piercing fire.
RIGHT / AM-17 MARINE: beautiful lively woman with dark navy long hair tied into low twin tails, blue eyes, white and navy sailor-inspired short tactical coat and stylish layered skirt over wetsuit inner layer, light flotation vest, waterproof radio, compact rifle slung safely, small orange rescue line, blue striped shoulder motif. A detachable sleek miniature landing-craft-shaped flotation rig at hips and feet with visible buoyancy pontoons and compact water propulsion, elegant V-shaped naval outline, no giant battleship turrets. Represents amphibious landing infantry.
Color/materials: coordinated ivory/charcoal/teal common faction language, differentiated warm field gear, diamond gunmetal armor, and navy maritime accents. Rich precise hardware details balanced with lovely faces and cloth folds.
Text: only small professional English column captions exactly "IF-09 / INFANTRY", "MB-03 / MAIN BATTLE TANK", "AM-17 / MARINE", and a discreet "CONCEPT STUDY" mark; no other text, no watermark, no logo.
Constraints: all characters visibly adult; original anime faces and costuming; physically intelligible weapon attachments, all figures complete and separated; make the contrast in light, armored and amphibious roles immediately legible. Beautiful polished game character key art, not generic military realism, not chibi, not photo, not an in-game screenshot.
```

## 输出与检查

- 立绘：`anime-units-v1-2026-10-09.png`，1536×1024，RGB，2,634,474 字节。
- Q 版：`chibi-units-v1-2026-10-09.png`，1536×1024，RGBA，2,893,884 字节；角点与顶部空白 alpha 为 0。
- 两张图均已保存到本工作区 `assets/concept`，没有接入当前游戏。
- 已目视检查三类角色的发色、主配色、单主炮／履带、轻装步枪和海军浮力模块。Q 版依照立绘生成，角色身份一致。
- Q 版已请求真实透明背景并检查透明通道；正式资产仍须单角色切图、统一锚点、减细节、清理柔边阴影和小尺寸识别验证。
- 当前只完成三个型号的双版本概念验证，不是 38 型号最终资源或动画图集。

## Q 版最终提示词

输入参考：本目录的 `anime-units-v1-2026-10-09.png`，身份／服装／装备参考；内置 image_gen，`transparent_background=true`。

```text
Use case: stylized-concept
Asset type: three-character chibi tactical-game art direction sheet with a genuinely transparent background.
Input image: the referenced three-character anime unit concept plate is the identity, colors, outfits and role reference. Transform these exact three character designs into matching adorable chibi female game units.
Primary request: Create a cohesive set of three original chibi mecha maiden battlefield designs corresponding to the reference INFANTRY, MAIN BATTLE TANK and MARINE, in that same left-to-right order. Preserve brunette bob infantry, silver long-haired tank, navy twin-tail marine, matching eye colors, white/charcoal/teal uniform accents and navy maritime details.
Style: premium clean 2D anime chibi game sprites, around 2.7 heads tall, large expressive eyes, simplified yet exquisite costume details, clear chunky silhouettes readable at 64-96 px, sharp clean outline, flat cel shadow plus restrained highlights. Female adult character designs simplified into chibi proportions, not a change to their in-world age.
Composition: three separate complete front-three-quarter figures on an actual transparent canvas, equal scale, generous transparent gaps, all feet and equipment fully visible. No frames, no background, no ground plane, no text, no labels, no watermark, no drawn checkerboard. Do not include the source reference captions.
LEFT: light infantry with chestnut bob, small rifle held neatly, compact backpack, lightweight white and charcoal skirt armor and boots, teal ring earpiece, cheerful alert expression. Most compact and light equipment silhouette.
CENTER: long silver-haired tank girl, diamond chest armor and wider gray mecha skirt, symmetric obvious miniature tracked locomotion chassis around the lower body supporting a single cannon fixed to a backpack turret via visible rigid mechanical support. Make the treads large and simplified enough to read, medium-weight main-battle silhouette, composed smile; one main gun, no dual guns or sword.
RIGHT: navy twin-tail marine, white-and-navy short coat, compact rifle, orange rescue cord, small readable buoyant V-shaped landing craft/pontoon module with water jets under and around feet, ready for amphibious deployment, lively expression. Naval blue striped motif, no battleship cannons.
Constraints: recognizable same three identities as reference; preserve light infantry vs tank vs amphibious marine distinctions; the armor and buoyancy devices are functional attachments, not random decorative shapes. Attractive polished chibi art suitable as a concept preview for the actual strategy-board units. This is a prototype sheet, not a finished animated atlas.
```
