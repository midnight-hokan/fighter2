// 灯郎「掌灯人」— zoner（R1 原创角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md
export default {
  "id": "c05",
  "name": "灯郎",
  "title": "掌灯人",
  "style": "清瘦的掌灯老人，灰布长袍，背一根旧灯杆，眼神像灯油一样平静",
  "archetype": "zoner",
  "stage": "s03",
  "colors": {
    "primary": "#ffcc33",
    "secondary": "#8a5a20",
    "skin": "#d9a878"
  },
  "ending": "灯油烧尽那天，路也走到了头。灯郎把灯杆一放，说：这条路，我亲自走完了。",
  "stats": {
    "health": 1050,
    "walkF": 2,
    "walkB": 2,
    "jumpV": 7.4,
    "jumpH": 2.8,
    "stunMax": 90,
    "throwRange": 36
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
    "name": "灯挑摔",
    "damage": 110,
    "stun": 8
  },
  "specials": [
    {
      "id": "denghuadan",
      "name": "灯花弹",
      "input": "236K",
      "desc": "灯芯弹，飞行道具，速度快",
      "startup": 12,
      "active": 1,
      "recovery": 28,
      "damage": 65,
      "chip": 12,
      "stun": 10,
      "hitstun": 18,
      "blockstun": 14,
      "projectile": {
        "speed": 4.2,
        "x": 30,
        "y": 54,
        "w": 24,
        "h": 16,
        "life": 200
      },
      "anim": "fireball"
    },
    {
      "id": "daiteng",
      "name": "大镫弹",
      "input": "623K",
      "desc": "大镫慢弹，飞行道具，命中击退大",
      "startup": 18,
      "active": 1,
      "recovery": 38,
      "damage": 140,
      "chip": 22,
      "stun": 14,
      "hitstun": 22,
      "blockstun": 16,
      "pushback": 18,
      "projectile": {
        "speed": 2.6,
        "x": 30,
        "y": 20,
        "w": 34,
        "h": 22,
        "life": 240
      },
      "anim": "fireball"
    },
    {
      "id": "dengzhuo",
      "name": "灯啄",
      "input": "214P",
      "desc": "近身快速戳拳，可取消",
      "startup": 6,
      "active": 3,
      "recovery": 14,
      "damage": 55,
      "chip": 10,
      "stun": 6,
      "hitstun": 12,
      "blockstun": 10,
      "cancel": true,
      "hitbox": {
        "x": 10,
        "y": 50,
        "w": 44,
        "h": 16
      },
      "anim": "punch"
    }
  ],
  "supers": [
    {
      "id": "denghuadrag",
      "name": "灯花龙",
      "input": "236236K",
      "desc": "灯杆挥出巨浪火弹，飞行道具",
      "startup": 14,
      "active": 1,
      "recovery": 40,
      "damage": 330,
      "chip": 52,
      "stun": 0,
      "hitstun": 30,
      "blockstun": 22,
      "knockdown": true,
      "projectile": {
        "speed": 2.8,
        "x": 36,
        "y": 30,
        "w": 44,
        "h": 30,
        "life": 300
      },
      "anim": "super",
      "sdm": {
        "damage": 510,
        "projectile": {
          "speed": 3.4,
          "x": 36,
          "y": 30,
          "w": 50,
          "h": 34,
          "life": 320
        }
      }
    }
  ]
};
