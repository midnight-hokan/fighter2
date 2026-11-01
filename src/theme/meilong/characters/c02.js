// 炭守「深井守望者」— charge（R1 原创角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md
export default {
  "id": "c02",
  "name": "炭守",
  "title": "深井守望者",
  "style": "中年矿工，体格敦实，穿厚皮褂，护目镜推在额头上，双掌老茧厚得能挡火花",
  "archetype": "charge",
  "colors": {
    "primary": "#b5651d",
    "secondary": "#e8d5a3",
    "skin": "#c9986a"
  },
  "ending": "深井的灯灭那天，炭守第一次走出黑暗。他抬头看见满天星子，才知道井外的世界从来不是黑的。",
  "stats": {
    "health": 1050,
    "walkF": 2,
    "walkB": 1.8,
    "jumpV": 7.6,
    "jumpH": 2.6,
    "stunMax": 110,
    "throwRange": 40
  },
  "normals": {
    "st.lp": {
      "name": "刺拳",
      "startup": 4,
      "active": 3,
      "recovery": 7,
      "damage": 31,
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
      "damage": 61,
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
      "damage": 102,
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
      "damage": 36,
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
      "damage": 66,
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
      "damage": 107,
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
      "damage": 26,
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
      "damage": 56,
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
      "damage": 97,
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
      "damage": 31,
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
      "damage": 56,
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
      "damage": 92,
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
      "damage": 36,
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
      "damage": 61,
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
      "damage": 92,
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
      "damage": 41,
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
      "damage": 66,
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
      "damage": 97,
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
    "name": "腕吊摔",
    "damage": 130,
    "stun": 10
  },
  "specials": [
    {
      "id": "baokong",
      "name": "爆空弹",
      "input": "[4]6P",
      "desc": "后蓄力前放，压缩瓦斯气团（飞行道具）",
      "startup": 14,
      "active": 1,
      "recovery": 34,
      "damage": 80,
      "chip": 15,
      "stun": 10,
      "hitstun": 18,
      "blockstun": 14,
      "projectile": {
        "speed": 3,
        "x": 30,
        "y": 56,
        "w": 30,
        "h": 20,
        "life": 240
      },
      "anim": "fireball"
    },
    {
      "id": "tanshui",
      "name": "炭水击",
      "input": "[4]6K",
      "desc": "后蓄力前放，贴地煤水波，下段",
      "startup": 18,
      "active": 1,
      "recovery": 40,
      "damage": 110,
      "chip": 20,
      "stun": 12,
      "hitstun": 20,
      "blockstun": 16,
      "level": "low",
      "projectile": {
        "speed": 2.2,
        "x": 26,
        "y": 8,
        "w": 40,
        "h": 14,
        "life": 260
      },
      "anim": "fireball"
    },
    {
      "id": "chongtianshan",
      "name": "冲天闪",
      "input": "[2]8K",
      "desc": "下蓄力上放，对空上勾，起手无敌",
      "startup": 6,
      "active": 10,
      "recovery": 26,
      "damage": 130,
      "chip": 12,
      "stun": 16,
      "hitstun": 24,
      "blockstun": 16,
      "knockdown": true,
      "invuln": [
        1,
        10
      ],
      "hitbox": {
        "x": 2,
        "y": 40,
        "w": 36,
        "h": 68
      },
      "anim": "uppercut"
    }
  ],
  "supers": [
    {
      "id": "longxuantan",
      "name": "龙旋炭钻",
      "input": "236236P",
      "desc": "全身压缩瓦斯，冲拳钻地突进",
      "startup": 8,
      "active": 26,
      "recovery": 32,
      "damage": 320,
      "chip": 45,
      "stun": 0,
      "hitstun": 30,
      "blockstun": 22,
      "knockdown": true,
      "invuln": [
        1,
        14
      ],
      "hitbox": {
        "x": 8,
        "y": 20,
        "w": 72,
        "h": 70
      },
      "move": {
        "vx": 3.6,
        "frames": 20,
        "at": 8
      },
      "anim": "super",
      "sdm": {
        "damage": 480,
        "invuln": [
          1,
          22
        ]
      }
    }
  ]
};
