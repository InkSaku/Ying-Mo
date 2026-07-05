(() => {
const galleryItems = [
    {
    id: "photo-001",
    src: "assets/gallery/photo-01.jpg",
    title: "傍晚的路口",
    desc: "今天风很轻，云也很慢，路口的灯刚刚亮起来。",
    author: "小墨",
    avatarText: "墨",
    date: "2026-07-02",
    location: "广州",
    mood: "安静",
    tags: ["日常", "傍晚", "城市"],
    likes: 18,
    comments: [
        { user: "小林", text: "这张好有夏天的感觉。" },
        { user: "阿南", text: "灯亮起来那一下很温柔。" }
    ],
    visibility: "friends"
    },
    {
    id: "photo-002",
    src: "assets/gallery/photo-02.jpg",
    title: "饭后散步",
    desc: "没有特别的目的，只是想把今晚的风也带回来。",
    author: "阿南",
    avatarText: "南",
    date: "2026-07-01",
    location: "珠江边",
    mood: "松弛",
    tags: ["散步", "夜晚", "朋友"],
    likes: 11,
    comments: [
        { user: "小墨", text: "普通日子也很可爱。" },
        { user: "鹿鹿", text: "看到这张就想出门走走。" }
    ],
    visibility: "friends"
    },
    {
    id: "photo-003",
    src: "assets/gallery/photo-03.jpg",
    title: "窗边的一点光",
    desc: "午后安静下来，桌上的影子慢慢移了一格。",
    author: "鹿鹿",
    avatarText: "鹿",
    date: "2026-06-30",
    location: "家里",
    mood: "柔软",
    tags: ["光", "房间", "午后"],
    likes: 15,
    comments: [
        { user: "阿南", text: "这个色调很映墨。" }
    ],
    visibility: "friends"
    },
    {
    id: "photo-004",
    src: "assets/gallery/photo-04.jpg",
    title: "雨停以后",
    desc: "地面还湿着，空气像刚洗过一样清亮。",
    author: "小林",
    avatarText: "林",
    date: "2026-06-29",
    location: "学校门口",
    mood: "清新",
    tags: ["雨后", "校园", "路口"],
    likes: 9,
    comments: [
        { user: "小墨", text: "这张有很干净的风。" }
    ],
    visibility: "public"
    },
    {
    id: "photo-005",
    src: "assets/gallery/photo-05.jpg",
    title: "一杯热饮",
    desc: "忙完以后坐下来，杯子里的热气让晚上慢了一点。",
    author: "小墨",
    avatarText: "墨",
    date: "2026-06-28",
    location: "小店",
    mood: "暖",
    tags: ["食物", "夜晚", "休息"],
    likes: 21,
    comments: [
        { user: "鹿鹿", text: "好像闻到热饮的味道了。" },
        { user: "小林", text: "这就是今天的小奖励。" }
    ],
    visibility: "friends"
    },
    {
    id: "photo-006",
    src: "assets/gallery/photo-06.jpg",
    title: "去见朋友的路上",
    desc: "手机里存下一张路边照片，像给今天做了一个标记。",
    author: "阿南",
    avatarText: "南",
    date: "2026-06-27",
    location: "地铁口",
    mood: "期待",
    tags: ["出门", "路上", "相见"],
    likes: 13,
    comments: [
        { user: "小墨", text: "这一刻很像故事开始。" }
    ],
    visibility: "friends"
    },
    {
    id: "photo-007",
    src: "assets/gallery/photo-07.jpg",
    title: "留给周末",
    desc: "没有安排也很好，慢慢吃饭，慢慢回消息。",
    author: "鹿鹿",
    avatarText: "鹿",
    date: "2026-06-26",
    location: "家附近",
    mood: "自在",
    tags: ["周末", "生活", "慢慢来"],
    likes: 16,
    comments: [
        { user: "阿南", text: "这个周末感好舒服。" },
        { user: "小林", text: "想把这句话也存下来。" }
    ],
    visibility: "private"
    }
];

const photoFeed = document.querySelector("#photoFeed");
const photoGrid = document.querySelector("#photoGrid");
const photoEmpty = document.querySelector("#photoEmpty");
const lightbox = document.querySelector("#photoLightbox");
const lightboxImage = document.querySelector("#photoLightboxImage");
const lightboxAuthor = document.querySelector("#photoLightboxAuthor");
const lightboxTitle = document.querySelector("#photoLightboxTitle");
const lightboxDesc = document.querySelector("#photoLightboxDesc");
const lightboxMeta = document.querySelector("#photoLightboxMeta");
const lightboxTags = document.querySelector("#photoLightboxTags");
const lightboxComments = document.querySelector("#photoLightboxComments");
const lightboxClose = document.querySelector("#photoLightboxClose");

let previousBodyOverflow = "";
let lastFocusedCard = null;

function visibilityText(value) {
    return {
    public: "公开",
    friends: "好友可见",
    private: "仅自己"
    }[value] || "好友可见";
}

function createProfileChip(item) {
    const chip = document.createElement("span");
    chip.className = "profile-chip";

    const avatar = document.createElement("span");
    avatar.className = "profile-chip__avatar";
    avatar.textContent = item.avatarText || item.author.slice(0, 1);

    const name = document.createElement("span");
    name.className = "profile-chip__name";
    name.textContent = item.author;

    chip.append(avatar, name);
    return chip;
}

function createTag(text, className = "photo-tag") {
    const tag = document.createElement("span");
    tag.className = className;
    tag.textContent = text;
    return tag;
}

function createPhotoCard(item, index) {
    const card = document.createElement("article");
    card.className = "photo-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `查看照片：${item.title}`);
    card.addEventListener("click", () => openPhotoPreview(index));
    card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPhotoPreview(index);
    }
    });

    const media = document.createElement("div");
    media.className = "photo-card__media";

    const image = document.createElement("img");
    image.src = item.src;
    image.alt = `照片：${item.title}`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
    card.classList.add("is-missing");
    });

    const placeholder = document.createElement("div");
    placeholder.className = "photo-card__placeholder";
    placeholder.textContent = "图片暂未找到，请检查 assets/gallery/ 中的文件名。";

    const hint = document.createElement("span");
    hint.className = "photo-card__hint";
    hint.textContent = "查看照片";

    const body = document.createElement("div");
    body.className = "photo-card__body";

    const meta = document.createElement("div");
    meta.className = "photo-card__meta";
    meta.append(createProfileChip(item));

    const date = document.createElement("span");
    date.className = "photo-card__date";
    date.textContent = item.date;
    meta.append(date);

    const title = document.createElement("h3");
    title.className = "photo-card__title";
    title.textContent = item.title;

    const desc = document.createElement("p");
    desc.className = "photo-card__desc";
    desc.textContent = item.desc;

    const footer = document.createElement("div");
    footer.className = "photo-card__footer";
    footer.append(createTag(item.mood, "mood-tag"));

    const stats = document.createElement("div");
    stats.className = "photo-card__stats";
    stats.innerHTML = `<span>${item.likes} 喜欢</span><span>${item.comments.length} 评论</span>`;
    footer.append(stats);

    const action = document.createElement("span");
    action.className = "photo-card__action";
    action.textContent = "查看照片";
    footer.append(action);

    media.append(image, placeholder, hint);
    body.append(meta, title, desc, footer);
    card.append(media, body);
    return card;
}

// openPhotoPreview(index) 用于打开照片详情，并把对应生活片段填入弹窗。
function openPhotoPreview(index) {
    const item = galleryItems[index];
    if (!item) return;

    lastFocusedCard = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
    previousBodyOverflow = document.body.style.overflow;

    lightboxImage.src = item.src;
    lightboxImage.alt = `照片：${item.title}`;
    lightboxAuthor.innerHTML = "";
    lightboxAuthor.append(createProfileChip(item));
    lightboxTitle.textContent = item.title;
    lightboxDesc.textContent = item.desc;

    lightboxMeta.innerHTML = "";
    [
    `时间：${item.date}`,
    `地点：${item.location}`,
    `心情：${item.mood}`,
    `可见范围：${visibilityText(item.visibility)}`,
    `${item.likes} 喜欢 · ${item.comments.length} 条评论`
    ].forEach((text) => {
    const line = document.createElement("span");
    line.textContent = text;
    lightboxMeta.append(line);
    });

    lightboxTags.innerHTML = "";
    item.tags.forEach((tag) => lightboxTags.append(createTag(tag)));

    lightboxComments.innerHTML = "";
    item.comments.forEach((comment) => {
    const row = document.createElement("div");
    row.className = "comment-item";
    const author = document.createElement("div");
    author.className = "comment-item__author";
    author.textContent = comment.user;
    const text = document.createElement("p");
    text.className = "comment-item__text";
    text.textContent = comment.text;
    row.append(author, text);
    lightboxComments.append(row);
    });

    lightbox.classList.add("is-active");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
}

// closePhotoPreview() 用于关闭详情，并恢复页面滚动。
function closePhotoPreview() {
    if (!lightbox.classList.contains("is-active")) return;

    lightbox.classList.remove("is-active");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = previousBodyOverflow;
    lightboxImage.src = "";

    if (lastFocusedCard) {
    lastFocusedCard.focus();
    }
}

function renderPhotos() {
    photoFeed.innerHTML = "";
    photoGrid.innerHTML = "";

    if (!galleryItems.length) {
    photoFeed.classList.add("is-hidden");
    photoGrid.classList.add("is-hidden");
    photoEmpty.classList.remove("is-hidden");
    return;
    }

    galleryItems.slice(0, 3).forEach((item) => {
    const index = galleryItems.findIndex((photo) => photo.id === item.id);
    photoFeed.append(createPhotoCard(item, index));
    });

    galleryItems.forEach((item, index) => {
    photoGrid.append(createPhotoCard(item, index));
    });

    photoFeed.classList.remove("is-hidden");
    photoGrid.classList.remove("is-hidden");
    photoEmpty.classList.add("is-hidden");
}

lightboxClose.addEventListener("click", closePhotoPreview);

// 点击遮罩空白区域关闭照片详情。
lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
    closePhotoPreview();
    }
});

// 按 Esc 关闭照片详情。
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
    closePhotoPreview();
    }
});

renderPhotos();
})();
