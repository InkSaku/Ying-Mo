"""批量导入《守望先锋》英雄、地图及其图片到 Ying-Mo。

放置位置建议：backend/scripts/import_overwatch_assets.py
从 backend 目录运行：

python scripts/import_overwatch_assets.py \
  --heroes-root ~/Documents/overwatch_heroes \
  --maps-root ~/Documents/守望先锋地图头像_最新版 \
  --admin 你的管理员用户名

重复执行是安全的：游戏、英雄、地图按稳定 slug 更新；已有图片默认保留。
需要覆盖已有图片时增加 --replace-images。
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

# 建议把本文件放在 backend/scripts/ 下。直接执行脚本时，将 backend/ 加入模块搜索路径。
_SCRIPT_PATH = Path(__file__).resolve()
_BACKEND_ROOT = (
    _SCRIPT_PATH.parent.parent
    if _SCRIPT_PATH.parent.name == "scripts"
    else _SCRIPT_PATH.parent
)
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import or_
from werkzeug.datastructures import FileStorage

from app import create_app
from app.auth.service import utcnow
from app.extensions import db
from app.games.service import is_catalog_admin, normalize_name, search_text
from app.models import Game, GameHero, GameMap, Media, MediaPurpose, User
from app.uploads.service import process_and_store_image
from app.uploads.storage import remove_media_files


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

# 目录名 -> 数据库存储值
HERO_ROLE_DIRS = {
    "坦克": "tank",
    "输出": "damage",
    "支援": "support",
}

MAP_TYPE_DIRS = {
    "攻防": "hybrid",
    "闪点": "flashpoint",
    "推车": "escort",
}

# 文件名 slug -> (中文名, 英文名)
# 中文名称按 2026-07 国服官网名称整理。
HERO_NAMES: dict[str, tuple[str, str]] = {
    # 坦克
    "domina": ("金驭", "Domina"),
    "hazard": ("骇灾", "Hazard"),
    "orisa": ("奥丽莎", "Orisa"),
    "roadhog": ("路霸", "Roadhog"),
    "wrecking-ball": ("破坏球", "Wrecking Ball"),
    "doomfist": ("末日铁拳", "Doomfist"),
    "junker-queen": ("渣客女王", "Junker Queen"),
    "ramattra": ("拉玛刹", "Ramattra"),
    "sigma": ("西格玛", "Sigma"),
    "zarya": ("查莉娅", "Zarya"),
    "dva": ("D.Va", "D.Va"),
    "mauga": ("毛加", "Mauga"),
    "reinhardt": ("莱因哈特", "Reinhardt"),
    "winston": ("温斯顿", "Winston"),
    # 输出
    "anran": ("安燃", "Anran"),
    "echo": ("回声", "Echo"),
    "hanzo": ("半藏", "Hanzo"),
    "reaper": ("死神", "Reaper"),
    "soldier-76": ("士兵：76", "Soldier: 76"),
    "tracer": ("猎空", "Tracer"),
    "ashe": ("艾什", "Ashe"),
    "emre": ("埃姆雷", "Emre"),
    "junkrat": ("狂鼠", "Junkrat"),
    "shion": ("死怨", "Shion"),
    "sombra": ("黑影", "Sombra"),
    "vendetta": ("斩仇", "Vendetta"),
    "bastion": ("堡垒", "Bastion"),
    "freja": ("弗蕾娅", "Freja"),
    "mei": ("美", "Mei"),
    "sierra": ("西拉", "Sierra"),
    "symmetra": ("秩序之光", "Symmetra"),
    "venture": ("探奇", "Venture"),
    "cassidy": ("卡西迪", "Cassidy"),
    "genji": ("源氏", "Genji"),
    "pharah": ("法老之鹰", "Pharah"),
    "sojourn": ("索杰恩", "Sojourn"),
    "torbjorn": ("托比昂", "Torbjörn"),
    "widowmaker": ("黑百合", "Widowmaker"),
    # 支援
    "ana": ("安娜", "Ana"),
    "brigitte": ("布丽吉塔", "Brigitte"),
    "jetpack-cat": ("飞天猫", "Jetpack Cat"),
    "kiriko": ("雾子", "Kiriko"),
    "lucio": ("卢西奥", "Lúcio"),
    "mizuki": ("瑞稀", "Mizuki"),
    "wuyang": ("无漾", "Wuyang"),
    "baptiste": ("巴蒂斯特", "Baptiste"),
    "illari": ("伊拉锐", "Illari"),
    "juno": ("朱诺", "Juno"),
    "lifeweaver": ("生命之梭", "Lifeweaver"),
    "mercy": ("天使", "Mercy"),
    "moira": ("莫伊拉", "Moira"),
    "zenyatta": ("禅雅塔", "Zenyatta"),
}

MAP_ENGLISH_OVERRIDES = {
    "Kings Row": "King's Row",
    "Watchpoint Gibraltar": "Watchpoint: Gibraltar",
    "Paraiso": "Paraíso",
}

MAP_CHINESE_OVERRIDES = {
    "监测站直布罗陀": "监测站：直布罗陀",
}


@dataclass(frozen=True)
class CatalogAsset:
    kind: str
    slug: str
    name_zh: str
    name_en: str
    category: str
    image_path: Path


def image_files(directory: Path) -> list[Path]:
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )


def scan_heroes(root: Path) -> list[CatalogAsset]:
    assets: list[CatalogAsset] = []
    unknown: list[str] = []

    for directory_name, role in HERO_ROLE_DIRS.items():
        directory = root / directory_name
        if not directory.is_dir():
            raise FileNotFoundError(f"缺少英雄目录：{directory}")

        for image_path in image_files(directory):
            slug = image_path.stem.strip().lower()
            names = HERO_NAMES.get(slug)
            if names is None:
                unknown.append(str(image_path))
                continue
            assets.append(
                CatalogAsset(
                    kind="hero",
                    slug=slug,
                    name_zh=names[0],
                    name_en=names[1],
                    category=role,
                    image_path=image_path,
                )
            )

    if unknown:
        joined = "\n  - ".join(unknown)
        raise ValueError(
            "发现脚本尚未登记的英雄文件，请先补充 HERO_NAMES：\n"
            f"  - {joined}"
        )
    return assets


def scan_maps(root: Path) -> list[CatalogAsset]:
    assets: list[CatalogAsset] = []

    for directory_name, map_type in MAP_TYPE_DIRS.items():
        directory = root / directory_name
        if not directory.is_dir():
            raise FileNotFoundError(f"缺少地图目录：{directory}")

        for image_path in image_files(directory):
            if "_" not in image_path.stem:
                raise ValueError(
                    f"地图文件名格式错误：{image_path.name}；"
                    "应为 中文名_English_Name.png"
                )

            name_zh_raw, name_en_raw = image_path.stem.split("_", 1)
            name_zh = MAP_CHINESE_OVERRIDES.get(name_zh_raw, name_zh_raw)
            name_en_plain = name_en_raw.replace("_", " ")
            name_en = MAP_ENGLISH_OVERRIDES.get(name_en_plain, name_en_plain)
            slug = name_en_raw.lower().replace("_", "-")

            assets.append(
                CatalogAsset(
                    kind="map",
                    slug=slug,
                    name_zh=name_zh,
                    name_en=name_en,
                    category=map_type,
                    image_path=image_path,
                )
            )
    return assets


def upsert_game(admin: User, version: str | None) -> Game:
    normalized_name = normalize_name("守望先锋")
    game = db.session.scalar(
        db.select(Game).where(
            or_(Game.slug == "overwatch", Game.normalized_name == normalized_name)
        )
    )
    if game is None:
        game = Game(
            slug="overwatch",
            created_by_id=admin.id,
            status="inactive",
        )
        db.session.add(game)

    game.name_zh = "守望先锋"
    game.name_en = "Overwatch"
    game.aliases = ["OW", "守望"]
    game.normalized_name = normalized_name
    game.search_text = search_text(game.name_zh, game.name_en, game.aliases)
    game.description = "地图优先的守望先锋英雄点位与实战经验目录。"
    if version:
        game.current_version = version
    db.session.flush()
    return game


def upsert_catalog_entity(
    game: Game,
    admin: User,
    asset: CatalogAsset,
) -> GameHero | GameMap:
    if asset.kind == "hero":
        normalized_name = normalize_name(asset.name_zh)
        entity = db.session.scalar(
            db.select(GameHero).where(
                GameHero.game_id == game.id,
                or_(
                    GameHero.slug == asset.slug,
                    GameHero.normalized_name == normalized_name,
                ),
            )
        )
        if entity is None:
            entity = GameHero(
                game_id=game.id,
                slug=asset.slug,
                created_by_id=admin.id,
            )
            db.session.add(entity)
        entity.role = asset.category
        entity.status = "active"
        entity.review_status = "approved"
    else:
        normalized_name = normalize_name(asset.name_zh)
        entity = db.session.scalar(
            db.select(GameMap).where(
                GameMap.game_id == game.id,
                or_(
                    GameMap.slug == asset.slug,
                    GameMap.normalized_name == normalized_name,
                ),
            )
        )
        if entity is None:
            entity = GameMap(
                game_id=game.id,
                slug=asset.slug,
                created_by_id=admin.id,
            )
            db.session.add(entity)
        entity.map_type = asset.category
        entity.current_status = "active"
        entity.review_status = "approved"

    entity.name_zh = asset.name_zh
    entity.name_en = asset.name_en
    entity.aliases = []
    entity.normalized_name = normalized_name
    entity.search_text = search_text(asset.name_zh, asset.name_en, [])
    entity.updated_at = utcnow()
    db.session.flush()
    return entity


def create_media(admin: User, image_path: Path) -> Media:
    content_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    with image_path.open("rb") as stream:
        file_storage = FileStorage(
            stream=stream,
            filename=image_path.name,
            content_type=content_type,
        )
        attributes = process_and_store_image(file_storage)

    media = Media(
        owner_id=admin.id,
        purpose=MediaPurpose.CONTENT,
        **attributes,
    )
    db.session.add(media)
    db.session.flush()
    return media


def bind_image(
    entity: GameHero | GameMap,
    asset: CatalogAsset,
    admin: User,
    replace_images: bool,
    created_media_files: list[SimpleNamespace],
    old_media_files: list[SimpleNamespace],
) -> str:
    media_attr = "avatar_media" if asset.kind == "hero" else "cover_media"
    media_id_attr = "avatar_media_id" if asset.kind == "hero" else "cover_media_id"
    bound_type = "game_hero_avatar" if asset.kind == "hero" else "game_map_cover"

    current_media = getattr(entity, media_attr)
    if current_media is not None and not replace_images:
        return "kept"

    new_media = create_media(admin, asset.image_path)
    created_media_files.append(
        SimpleNamespace(
            storage_key=new_media.storage_key,
            thumbnail_key=new_media.thumbnail_key,
        )
    )
    new_media.bound_type = bound_type
    new_media.bound_id = entity.id
    new_media.bound_at = utcnow()
    setattr(entity, media_id_attr, new_media.id)

    if current_media is not None:
        old_media_files.append(
            SimpleNamespace(
                storage_key=current_media.storage_key,
                thumbnail_key=current_media.thumbnail_key,
            )
        )
        db.session.delete(current_media)
        return "replaced"
    return "created"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="批量导入 Ying-Mo 的守望先锋英雄、地图及图片。"
    )
    parser.add_argument("--heroes-root", type=Path, required=True)
    parser.add_argument("--maps-root", type=Path, required=True)
    parser.add_argument("--admin", required=True, help="内容管理员或系统管理员用户名")
    parser.add_argument("--version", help="写入 games.current_version 的版本说明")
    parser.add_argument(
        "--replace-images",
        action="store_true",
        help="覆盖数据库中已经绑定的英雄头像和地图封面",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只扫描并检查目录，不修改数据库或图片存储",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    heroes_root = args.heroes_root.expanduser().resolve()
    maps_root = args.maps_root.expanduser().resolve()

    hero_assets = scan_heroes(heroes_root)
    map_assets = scan_maps(maps_root)

    print(f"扫描完成：英雄 {len(hero_assets)} 个，地图 {len(map_assets)} 张。")
    if args.dry_run:
        for asset in [*hero_assets, *map_assets]:
            print(
                f"[检查] {asset.kind:<4} {asset.slug:<24} "
                f"{asset.name_zh} / {asset.name_en} -> {asset.image_path}"
            )
        print("dry-run 完成，未修改数据库和上传目录。")
        return

    app = create_app()
    created_media_files: list[SimpleNamespace] = []
    old_media_files: list[SimpleNamespace] = []

    with app.app_context():
        admin = db.session.scalar(
            db.select(User).where(User.username == args.admin)
        )
        if admin is None:
            raise RuntimeError(f"未找到管理员用户：{args.admin}")
        if not is_catalog_admin(admin):
            raise RuntimeError(
                f"用户 {args.admin} 不是有效的内容管理员或系统管理员。"
            )

        counters = {
            "hero": 0,
            "map": 0,
            "image_created": 0,
            "image_replaced": 0,
            "image_kept": 0,
        }

        try:
            game = upsert_game(admin, args.version)
            for asset in [*hero_assets, *map_assets]:
                entity = upsert_catalog_entity(game, admin, asset)
                image_result = bind_image(
                    entity=entity,
                    asset=asset,
                    admin=admin,
                    replace_images=args.replace_images,
                    created_media_files=created_media_files,
                    old_media_files=old_media_files,
                )
                counters[asset.kind] += 1
                counters[f"image_{image_result}"] += 1
                print(
                    f"[导入] {asset.kind:<4} {asset.name_zh:<12} "
                    f"slug={asset.slug:<24} image={image_result}"
                )

            game.status = "active"
            db.session.commit()
        except Exception:
            db.session.rollback()
            for media_files in created_media_files:
                remove_media_files(media_files)
            raise

        # 旧文件必须在数据库提交成功后再删除，避免回滚后数据库仍引用已删除文件。
        for media_files in old_media_files:
            remove_media_files(media_files)

        print("\n导入成功：")
        print(f"  英雄：{counters['hero']}")
        print(f"  地图：{counters['map']}")
        print(f"  新增图片：{counters['image_created']}")
        print(f"  替换图片：{counters['image_replaced']}")
        print(f"  保留已有图片：{counters['image_kept']}")
        print("  游戏状态：active")


if __name__ == "__main__":
    main()
