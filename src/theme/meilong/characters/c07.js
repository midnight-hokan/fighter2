// 铜首「顶梁大汉」— power（R1 原创角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md
export default {
  "id": "c07",
  "name": "铜首",
  "title": "顶梁大汉",
  "style": "顶梁工大汉，铜色工装，手臂粗得像支柱，眼皮很少抬，一拳下去地面掉煤渣",
  "archetype": "power",
  "colors": {
    "primary": "#722f37",
    "secondary": "#caa06a",
    "skin": "#a9765a"
  },
  "ending": "支柱立住了，铜首弯下腰。他顶过一万根柱子，第一次，顶住的是自己的心。",
  "stats": {
    "health": 1080,
    "walkF": 1.6,
    "walkB": 1.4,
    "jumpV": 6.8,
    "jumpH": 2.4,
    "stunMax": 120,
    "throwRange": 50
  },
  "normals": {
    "st.lp": {
      "name": "刺拳",
      "startup": 5,
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
      "damage": 63,
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
      "startup": 8,
      "active": 4,
      "recovery": 20,
      "damage": 105,
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
      "startup": 6,
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
      "startup": 10,
      "active": 4,
      "recovery": 22,
      "damage": 110,
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
      "damage": 100,
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
      "damage": 58,
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
      "damage": 95,
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
    "name": "石投",
    "damage": 140,
    "stun": 12
  },
  "specials": [
    {
      "id": "chongtiant",
      "name": "冲天突",
      "input": "623P",
      "desc": "升龙式重拳，起手无敌，击飞",
      "startup": 8,
      "active": 12,
      "recovery": 28,
      "damage": 150,
      "chip": 15,
      "stun": 18,
      "hitstun": 26,
      "blockstun": 18,
      "knockdown": true,
      "invuln": [
        1,
        8
      ],
      "hitbox": {
        "x": 2,
        "y": 40,
        "w": 40,
        "h": 68
      },
      "move": {
        "vy": 6.5,
        "vx": 1,
        "at": 5
      },
      "anim": "uppercut"
    },
    {
      "id": "zhongdanluo",
      "name": "重弹落",
      "input": "425P",
      "desc": "下后上砸落拳，下段击倒",
      "startup": 14,
      "active": 10,
      "recovery": 30,
      "damage": 160,
      "chip": 20,
      "stun": 18,
      "hitstun": 24,
      "blockstun": 18,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": -8,
        "y": 0,
        "w": 60,
        "h": 64
      },
      "anim": "heavy"
    },
    {
      "id": "zhongkeng",
      "name": "重坑踹",
      "input": "624K",
      "desc": "下后下踹翻，击倒",
      "startup": 12,
      "active": 6,
      "recovery": 32,
      "damage": 130,
      "chip": 18,
      "stun": 16,
      "hitstun": 22,
      "blockstun": 16,
      "knockdown": true,
      "hitbox": {
        "x": 4,
        "y": 10,
        "w": 56,
        "h": 30
      },
      "anim": "highkick"
    }
  ],
  "supers": [
    {
      "id": "tongshoulong",
      "name": "铜首龙",
      "input": "623623P",
      "desc": "顶梁之拳，重压突进",
      "startup": 12,
      "active": 28,
      "recovery": 38,
      "damage": 380,
      "chip": 50,
      "stun": 0,
      "hitstun": 30,
      "blockstun": 24,
      "knockdown": true,
      "invuln": [
        1,
        14
      ],
      "hitbox": {
        "x": 0,
        "y": 10,
        "w": 76,
        "h": 72
      },
      "move": {
        "vx": 3,
        "frames": 22,
        "at": 12
      },
      "anim": "super",
      "sdm": {
        "damage": 500,
        "invuln": [
          1,
          20
        ]
      }
    }
  ]
};
