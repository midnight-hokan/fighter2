// 灰雁「赶路人」— balanced（R1 原创角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md
export default {
  "id": "c08",
  "name": "灰雁",
  "title": "赶路人",
  "style": "灰袍赶路人，背灯拄木杖，脚程不快不慢，像矿道尽头永远飞不走的那只灰雁",
  "archetype": "balanced",
  "colors": {
    "primary": "#7b5ea7",
    "secondary": "#cfc4e0",
    "skin": "#d3a982"
  },
  "ending": "雁群往南飞，灰雁跟着飞。路还很长，但他不再一个人走，灯就够亮了。",
  "stats": {
    "health": 1000,
    "walkF": 2.3,
    "walkB": 1.9,
    "jumpV": 8.2,
    "jumpH": 3,
    "stunMax": 100,
    "throwRange": 44
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
      "startup": 8,
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
      "startup": 10,
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
    "name": "两手提摔",
    "damage": 120,
    "stun": 10
  },
  "specials": [
    {
      "id": "huiyan",
      "name": "灰炎弹",
      "input": "236P",
      "desc": "杖尖灯焰弹，飞行道具",
      "startup": 12,
      "active": 1,
      "recovery": 28,
      "damage": 55,
      "chip": 10,
      "stun": 9,
      "hitstun": 16,
      "blockstun": 13,
      "projectile": {
        "speed": 3.8,
        "x": 32,
        "y": 56,
        "w": 24,
        "h": 16,
        "life": 220
      },
      "anim": "fireball"
    },
    {
      "id": "huihe",
      "name": "灰鹤蹴",
      "input": "425K",
      "desc": "下后上跃起回旋踢",
      "startup": 10,
      "active": 8,
      "recovery": 22,
      "damage": 78,
      "chip": 10,
      "stun": 11,
      "hitstun": 18,
      "blockstun": 13,
      "hitbox": {
        "x": -10,
        "y": 30,
        "w": 56,
        "h": 24
      },
      "move": {
        "vx": 2.2,
        "vy": 2.6,
        "at": 7
      },
      "anim": "highkick"
    },
    {
      "id": "huayan",
      "name": "华炎蹴",
      "input": "623K",
      "desc": "上挑旋踢，对空",
      "startup": 7,
      "active": 12,
      "recovery": 26,
      "damage": 110,
      "chip": 12,
      "stun": 14,
      "hitstun": 22,
      "blockstun": 15,
      "knockdown": true,
      "hitbox": {
        "x": 2,
        "y": 40,
        "w": 36,
        "h": 66
      },
      "move": {
        "vy": 6,
        "vx": 0.8,
        "at": 4
      },
      "anim": "uppercut"
    }
  ],
  "supers": [
    {
      "id": "huiyanlong",
      "name": "灰雁龙",
      "input": "214236P",
      "desc": "杖挥灰焰龙卷，中距离贯穿",
      "startup": 12,
      "active": 14,
      "recovery": 34,
      "damage": 255,
      "chip": 38,
      "stun": 0,
      "hitstun": 30,
      "blockstun": 22,
      "knockdown": true,
      "invuln": [
        1,
        8
      ],
      "hitbox": {
        "x": 6,
        "y": 20,
        "w": 72,
        "h": 68
      },
      "move": {
        "vx": 2.8,
        "frames": 14,
        "at": 8
      },
      "anim": "super",
      "sdm": {
        "damage": 400
      }
    }
  ]
};
