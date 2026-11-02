// 罗铮「矿山救护队员」— charge（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c02",
  "name": "罗铮",
  "title": "矿山救护队员",
  "style": "三十五岁救护中队老队员，橙红色救护服，背正压氧气呼吸器，面罩推在额头上，腰挂救援钩和绳索，体格敦实",
  "archetype": "charge",
  "stage": "s01",
  "colors": {
    "primary": "#e05a2b",
    "secondary": "#f0ead6",
    "skin": "#c9986a"
  },
  "intro": "我的本事是从险区里带人出来，不是在擂台上表演。不过，今天破个例。",
  "story": "传言改造后井下人少了，救护队要缩编。他不服：\"人少了，救援就不要了？\"他要用擂台证明，救护队的本事一样也不能丢。",
  "ending": "智能化之后，救护队不但没缩编，还配上了无人机和井下机器人，罗铮成了第一任技术教官。他第一堂课对新队员说：\"机器能进去，人也得能进去。\"",
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
      "name": "快拳",
      "startup": 5,
      "active": 3,
      "recovery": 9,
      "damage": 31,
      "stun": 4,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 12,
        "y": 62,
        "w": 42,
        "h": 14
      },
      "cancel": true,
      "pushback": 8,
      "anim": "punch"
    },
    "st.mp": {
      "name": "直拳",
      "startup": 7,
      "active": 3,
      "recovery": 14,
      "damage": 62,
      "stun": 8,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 12,
        "y": 62,
        "w": 50,
        "h": 16
      },
      "cancel": true,
      "anim": "punch"
    },
    "st.hp": {
      "name": "救护重拳",
      "startup": 9,
      "active": 4,
      "recovery": 22,
      "damage": 104,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 15,
      "hitbox": {
        "x": 12,
        "y": 60,
        "w": 56,
        "h": 18
      },
      "pushback": 14,
      "anim": "heavy"
    },
    "st.lk": {
      "name": "前踢",
      "startup": 6,
      "active": 3,
      "recovery": 11,
      "damage": 36,
      "stun": 4,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 10,
        "y": 30,
        "w": 48,
        "h": 14
      },
      "anim": "kick"
    },
    "st.mk": {
      "name": "侧踹",
      "startup": 8,
      "active": 3,
      "recovery": 16,
      "damage": 68,
      "stun": 8,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 10,
        "y": 40,
        "w": 56,
        "h": 16
      },
      "anim": "kick"
    },
    "st.hk": {
      "name": "钩踢",
      "startup": 11,
      "active": 4,
      "recovery": 24,
      "damage": 109,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 15,
      "hitbox": {
        "x": 10,
        "y": 56,
        "w": 64,
        "h": 18
      },
      "pushback": 16,
      "anim": "highkick"
    },
    "cr.lp": {
      "name": "蹲快拳",
      "startup": 5,
      "active": 2,
      "recovery": 9,
      "damage": 26,
      "stun": 3,
      "hitstun": 11,
      "blockstun": 8,
      "hitbox": {
        "x": 10,
        "y": 40,
        "w": 40,
        "h": 12
      },
      "cancel": true,
      "anim": "punch"
    },
    "cr.mp": {
      "name": "蹲直拳",
      "startup": 7,
      "active": 3,
      "recovery": 14,
      "damage": 57,
      "stun": 7,
      "hitstun": 15,
      "blockstun": 11,
      "hitbox": {
        "x": 10,
        "y": 38,
        "w": 48,
        "h": 14
      },
      "cancel": true,
      "anim": "punch"
    },
    "cr.hp": {
      "name": "上勾拳",
      "startup": 8,
      "active": 5,
      "recovery": 24,
      "damage": 99,
      "stun": 12,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 4,
        "y": 50,
        "w": 44,
        "h": 54
      },
      "cancel": true,
      "anim": "upper"
    },
    "cr.lk": {
      "name": "低踢",
      "startup": 6,
      "active": 3,
      "recovery": 11,
      "damage": 31,
      "stun": 3,
      "hitstun": 11,
      "blockstun": 8,
      "level": "low",
      "hitbox": {
        "x": 10,
        "y": 0,
        "w": 50,
        "h": 12
      },
      "cancel": true,
      "anim": "lowkick"
    },
    "cr.mk": {
      "name": "扫腿",
      "startup": 8,
      "active": 3,
      "recovery": 17,
      "damage": 57,
      "stun": 7,
      "hitstun": 15,
      "blockstun": 11,
      "level": "low",
      "hitbox": {
        "x": 10,
        "y": 0,
        "w": 60,
        "h": 12
      },
      "cancel": true,
      "anim": "lowkick"
    },
    "cr.hk": {
      "name": "钩扫腿",
      "startup": 10,
      "active": 4,
      "recovery": 26,
      "damage": 94,
      "stun": 12,
      "hitstun": 18,
      "blockstun": 13,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": 8,
        "y": 0,
        "w": 68,
        "h": 14
      },
      "anim": "sweep"
    },
    "j.lp": {
      "name": "跳拳",
      "startup": 5,
      "active": 6,
      "recovery": 6,
      "damage": 36,
      "stun": 5,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 6,
        "y": 30,
        "w": 38,
        "h": 16
      },
      "anim": "punch"
    },
    "j.mp": {
      "name": "跳直拳",
      "startup": 7,
      "active": 5,
      "recovery": 8,
      "damage": 62,
      "stun": 9,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 8,
        "y": 26,
        "w": 44,
        "h": 18
      },
      "anim": "punch"
    },
    "j.hp": {
      "name": "跳重拳",
      "startup": 9,
      "active": 5,
      "recovery": 10,
      "damage": 94,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 8,
        "y": 20,
        "w": 50,
        "h": 22
      },
      "anim": "heavy"
    },
    "j.lk": {
      "name": "跳膝",
      "startup": 6,
      "active": 7,
      "recovery": 6,
      "damage": 42,
      "stun": 5,
      "hitstun": 12,
      "blockstun": 9,
      "hitbox": {
        "x": 4,
        "y": 10,
        "w": 42,
        "h": 18
      },
      "anim": "kick"
    },
    "j.mk": {
      "name": "跳踢",
      "startup": 7,
      "active": 5,
      "recovery": 8,
      "damage": 68,
      "stun": 9,
      "hitstun": 16,
      "blockstun": 12,
      "hitbox": {
        "x": 6,
        "y": 6,
        "w": 48,
        "h": 18
      },
      "anim": "kick"
    },
    "j.hk": {
      "name": "跳旋踢",
      "startup": 9,
      "active": 5,
      "recovery": 10,
      "damage": 99,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 14,
      "hitbox": {
        "x": 6,
        "y": 4,
        "w": 56,
        "h": 20
      },
      "anim": "highkick"
    }
  },
  "throw": {
    "name": "担架摔",
    "damage": 130,
    "stun": 10
  },
  "specials": [
    {
      "id": "baokong",
      "name": "抛救生绳",
      "input": "[4]6P",
      "desc": "后蓄力前放，抛出救生绳（飞行道具）",
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
      "name": "照明信号弹",
      "input": "[4]6K",
      "desc": "后蓄力前放，贴地飞出的照明信号弹，下段",
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
      "name": "救援钩上挑",
      "input": "[2]8K",
      "desc": "下蓄力上放，救援钩对空上挑，起手无敌",
      "startup": 6,
      "active": 10,
      "recovery": 26,
      "damage": 105,
      "chip": 12,
      "stun": 16,
      "hitstun": 20,
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
    },
    {
      "id": "gousao",
      "name": "钩扫",
      "input": "3HK",
      "desc": "后下重脚，救援钩拖扫，下段击倒",
      "startup": 12,
      "active": 5,
      "recovery": 24,
      "damage": 100,
      "chip": 12,
      "stun": 12,
      "hitstun": 18,
      "blockstun": 14,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": -4,
        "y": 0,
        "w": 58,
        "h": 14
      },
      "anim": "sweep"
    }
  ],
  "supers": [
    {
      "id": "longxuantan",
      "name": "生命通道",
      "input": "236236P",
      "desc": "展开生命通道，冲拳钻地突进",
      "startup": 8,
      "active": 26,
      "recovery": 32,
      "damage": 280,
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
