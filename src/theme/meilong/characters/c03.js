// 钢驮「运矿巨汉」— grappler（R1 原创角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md
export default {
  "id": "c03",
  "name": "钢驮",
  "title": "运矿巨汉",
  "style": "身高两米的运矿工，钢架背心配厚底工靴，肩宽得像一辆矿车，走路带起煤尘",
  "archetype": "grappler",
  "stage": "s06",
  "colors": {
    "primary": "#5a6b7a",
    "secondary": "#9aa7b4",
    "skin": "#b98a5e"
  },
  "ending": "最后一车煤拉上井的那天，钢驮解下了挽具。他这辈子拉的都是别人的路，从今往后，拉自己的。",
  "stats": {
    "health": 1150,
    "walkF": 1.8,
    "walkB": 1.6,
    "jumpV": 7,
    "jumpH": 2.2,
    "stunMax": 130,
    "throwRange": 58
  },
  "normals": {
    "st.lp": {
      "name": "刺拳",
      "startup": 4,
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
      "startup": 6,
      "active": 3,
      "recovery": 12,
      "damage": 66,
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
      "startup": 9,
      "active": 4,
      "recovery": 20,
      "damage": 110,
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
      "startup": 5,
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
      "name": "中段踢",
      "startup": 7,
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
      "name": "回旋踢",
      "startup": 11,
      "active": 4,
      "recovery": 22,
      "damage": 116,
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
      "name": "蹲刺拳",
      "startup": 4,
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
      "startup": 6,
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
      "startup": 7,
      "active": 5,
      "recovery": 22,
      "damage": 105,
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
      "name": "蹲踢",
      "startup": 5,
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
      "startup": 7,
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
      "name": "大扫堂",
      "startup": 9,
      "active": 4,
      "recovery": 24,
      "damage": 99,
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
      "name": "跳刺拳",
      "startup": 4,
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
      "startup": 6,
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
      "startup": 8,
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
      "startup": 5,
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
      "startup": 6,
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
      "name": "跳重踢",
      "startup": 8,
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
    "name": "黑推摔",
    "damage": 150,
    "stun": 12
  },
  "specials": [
    {
      "id": "zhongdan",
      "name": "重弹摔",
      "input": "360P",
      "desc": "一圈指令投，抱摔砸地",
      "startup": 8,
      "active": 2,
      "recovery": 30,
      "damage": 160,
      "stun": 12,
      "throw": true,
      "range": 56,
      "anim": "throw"
    },
    {
      "id": "suiluo",
      "name": "碎落",
      "input": "425P",
      "desc": "下后上前砸落，下段击倒",
      "startup": 10,
      "active": 8,
      "recovery": 26,
      "damage": 110,
      "chip": 14,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 14,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": -6,
        "y": 0,
        "w": 56,
        "h": 60
      },
      "anim": "heavy"
    },
    {
      "id": "kengtai",
      "name": "坑台旋",
      "input": "214K",
      "desc": "扫堂腿，下段击倒",
      "startup": 8,
      "active": 6,
      "recovery": 22,
      "damage": 90,
      "chip": 10,
      "stun": 10,
      "hitstun": 16,
      "blockstun": 12,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": 0,
        "y": 0,
        "w": 62,
        "h": 16
      },
      "anim": "sweep"
    }
  ],
  "supers": [
    {
      "id": "chaozhong",
      "name": "超重摔",
      "input": "236236K",
      "desc": "扛起对手整圈砸地，下段",
      "startup": 10,
      "active": 22,
      "recovery": 36,
      "damage": 350,
      "chip": 48,
      "stun": 0,
      "hitstun": 30,
      "blockstun": 24,
      "level": "low",
      "knockdown": true,
      "invuln": [
        1,
        8
      ],
      "hitbox": {
        "x": -10,
        "y": 0,
        "w": 80,
        "h": 80
      },
      "move": {
        "vx": 2.6,
        "frames": 18,
        "at": 10
      },
      "anim": "super",
      "sdm": {
        "damage": 480
      }
    }
  ]
};
