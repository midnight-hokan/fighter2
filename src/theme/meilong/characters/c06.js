// 方萤「矿灯房女工」— speed（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c06",
  "name": "方萤",
  "title": "矿灯房女工",
  "style": "二十一岁娇小身形，灯房蓝色工作服系浅色围裙，两手各拎一盏矿灯，口袋插充电线",
  "archetype": "speed",
  "stage": "s01",
  "colors": {
    "primary": "#3d8bb5",
    "secondary": "#f0ead6",
    "skin": "#d8a377"
  },
  "intro": "你的灯，是我充的电。",
  "story": "她听说头灯里面装的，是黑岭第一盏灯的原装灯头。她从十五岁起就想亲手修一修那盏灯，让它再亮一次。",
  "ending": "方萤捧着头灯回到灯房，用了一整夜把它修好了。六十周年庆典上，头灯在矿史馆里重新亮起来。后来智能矿灯进矿，她成了矿上第一个\"智能矿灯管理员\"，徽章上的编号是 001。",
  "stats": {
    "health": 980,
    "walkF": 3.4,
    "walkB": 2.6,
    "jumpV": 9.2,
    "jumpH": 3.6,
    "stunMax": 70,
    "throwRange": 38
  },
  "normals": {
    "st.lp": {
      "name": "快拳",
      "startup": 3,
      "active": 3,
      "recovery": 7,
      "damage": 30,
      "stun": 4,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 12,
        "y": 62,
        "w": 38,
        "h": 14
      },
      "cancel": true,
      "pushback": 8,
      "anim": "punch"
    },
    "st.mp": {
      "name": "直拳",
      "startup": 5,
      "active": 3,
      "recovery": 12,
      "damage": 60,
      "stun": 8,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 12,
        "y": 62,
        "w": 46,
        "h": 16
      },
      "cancel": true,
      "anim": "punch"
    },
    "st.hp": {
      "name": "重拳",
      "startup": 7,
      "active": 4,
      "recovery": 20,
      "damage": 100,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 15,
      "hitbox": {
        "x": 12,
        "y": 60,
        "w": 52,
        "h": 18
      },
      "pushback": 14,
      "anim": "heavy"
    },
    "st.lk": {
      "name": "前踢",
      "startup": 4,
      "active": 3,
      "recovery": 9,
      "damage": 35,
      "stun": 4,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 10,
        "y": 30,
        "w": 44,
        "h": 14
      },
      "anim": "kick"
    },
    "st.mk": {
      "name": "侧踹",
      "startup": 6,
      "active": 3,
      "recovery": 14,
      "damage": 65,
      "stun": 8,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 10,
        "y": 40,
        "w": 52,
        "h": 16
      },
      "anim": "kick"
    },
    "st.hk": {
      "name": "旋踢",
      "startup": 9,
      "active": 4,
      "recovery": 22,
      "damage": 105,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 15,
      "hitbox": {
        "x": 10,
        "y": 56,
        "w": 60,
        "h": 18
      },
      "pushback": 16,
      "anim": "highkick"
    },
    "cr.lp": {
      "name": "蹲快拳",
      "startup": 3,
      "active": 2,
      "recovery": 7,
      "damage": 25,
      "stun": 3,
      "hitstun": 11,
      "blockstun": 8,
      "hitbox": {
        "x": 10,
        "y": 40,
        "w": 36,
        "h": 12
      },
      "cancel": true,
      "anim": "punch"
    },
    "cr.mp": {
      "name": "蹲直拳",
      "startup": 5,
      "active": 3,
      "recovery": 12,
      "damage": 55,
      "stun": 7,
      "hitstun": 15,
      "blockstun": 11,
      "hitbox": {
        "x": 10,
        "y": 38,
        "w": 44,
        "h": 14
      },
      "cancel": true,
      "anim": "punch"
    },
    "cr.hp": {
      "name": "上勾拳",
      "startup": 6,
      "active": 5,
      "recovery": 22,
      "damage": 95,
      "stun": 12,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 4,
        "y": 50,
        "w": 40,
        "h": 54
      },
      "cancel": true,
      "anim": "upper"
    },
    "cr.lk": {
      "name": "低踢",
      "startup": 4,
      "active": 3,
      "recovery": 9,
      "damage": 30,
      "stun": 3,
      "hitstun": 11,
      "blockstun": 8,
      "level": "low",
      "hitbox": {
        "x": 10,
        "y": 0,
        "w": 46,
        "h": 12
      },
      "cancel": true,
      "anim": "lowkick"
    },
    "cr.mk": {
      "name": "扫腿",
      "startup": 6,
      "active": 3,
      "recovery": 15,
      "damage": 55,
      "stun": 7,
      "hitstun": 15,
      "blockstun": 11,
      "level": "low",
      "hitbox": {
        "x": 10,
        "y": 0,
        "w": 56,
        "h": 12
      },
      "cancel": true,
      "anim": "lowkick"
    },
    "cr.hk": {
      "name": "扫堂腿",
      "startup": 8,
      "active": 4,
      "recovery": 24,
      "damage": 90,
      "stun": 12,
      "hitstun": 18,
      "blockstun": 13,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": 8,
        "y": 0,
        "w": 64,
        "h": 14
      },
      "anim": "sweep"
    },
    "j.lp": {
      "name": "跳拳",
      "startup": 3,
      "active": 6,
      "recovery": 4,
      "damage": 35,
      "stun": 5,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 6,
        "y": 30,
        "w": 34,
        "h": 16
      },
      "anim": "punch"
    },
    "j.mp": {
      "name": "跳直拳",
      "startup": 5,
      "active": 5,
      "recovery": 6,
      "damage": 60,
      "stun": 9,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 8,
        "y": 26,
        "w": 40,
        "h": 18
      },
      "anim": "punch"
    },
    "j.hp": {
      "name": "跳重拳",
      "startup": 7,
      "active": 5,
      "recovery": 8,
      "damage": 90,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 8,
        "y": 20,
        "w": 46,
        "h": 22
      },
      "anim": "heavy"
    },
    "j.lk": {
      "name": "跳膝",
      "startup": 4,
      "active": 7,
      "recovery": 4,
      "damage": 40,
      "stun": 5,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 4,
        "y": 10,
        "w": 38,
        "h": 18
      },
      "anim": "kick"
    },
    "j.mk": {
      "name": "跳踢",
      "startup": 5,
      "active": 5,
      "recovery": 6,
      "damage": 65,
      "stun": 9,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 6,
        "y": 6,
        "w": 44,
        "h": 18
      },
      "anim": "kick"
    },
    "j.hk": {
      "name": "跳旋踢",
      "startup": 7,
      "active": 5,
      "recovery": 8,
      "damage": 95,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 6,
        "y": 4,
        "w": 52,
        "h": 20
      },
      "anim": "highkick"
    }
  },
  "throw": {
    "name": "灯绳摔",
    "damage": 105,
    "stun": 8
  },
  "specials": [
    {
      "id": "shanfengt",
      "name": "充电冲刺",
      "input": "63214P",
      "desc": "后下前下前快拳，高速突进",
      "startup": 6,
      "active": 8,
      "recovery": 14,
      "damage": 88,
      "chip": 8,
      "stun": 9,
      "hitstun": 26,
      "blockstun": 11,
      "hitbox": {
        "x": -14,
        "y": 40,
        "w": 52,
        "h": 18
      },
      "move": {
        "vx": 3.4,
        "frames": 12,
        "at": 6
      },
      "anim": "rush"
    },
    {
      "id": "feihua",
      "name": "灯链旋",
      "input": "41236K",
      "desc": "下后下前跃起回旋踢",
      "startup": 7,
      "active": 8,
      "recovery": 16,
      "damage": 80,
      "chip": 9,
      "stun": 10,
      "hitstun": 17,
      "blockstun": 12,
      "hitbox": {
        "x": -12,
        "y": 30,
        "w": 54,
        "h": 22
      },
      "move": {
        "vx": 2.4,
        "vy": 3,
        "at": 6
      },
      "anim": "highkick"
    },
    {
      "id": "jifengdan",
      "name": "双灯连闪",
      "input": "236P",
      "desc": "短程快弹，飞行道具，存在时间短",
      "startup": 9,
      "active": 1,
      "recovery": 22,
      "damage": 55,
      "chip": 8,
      "stun": 8,
      "hitstun": 14,
      "blockstun": 11,
      "projectile": {
        "speed": 5.5,
        "x": 28,
        "y": 56,
        "w": 22,
        "h": 14,
        "life": 110
      },
      "anim": "fireball"
    }
  ],
  "supers": [
    {
      "id": "jifenglong",
      "name": "万灯齐明",
      "input": "236236P",
      "desc": "双灯满电，化风连续突刺，高速贯穿",
      "startup": 5,
      "active": 26,
      "recovery": 26,
      "damage": 310,
      "chip": 40,
      "stun": 0,
      "hitstun": 28,
      "blockstun": 20,
      "knockdown": true,
      "invuln": [
        1,
        8
      ],
      "hitbox": {
        "x": -18,
        "y": 20,
        "w": 78,
        "h": 56
      },
      "move": {
        "vx": 4,
        "frames": 20,
        "at": 5
      },
      "anim": "super",
      "sdm": {
        "damage": 450
      }
    }
  ]
};
