// 雷钧「机电队长」— grappler（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c03",
  "name": "雷钧",
  "title": "机电队长",
  "style": "四十二岁全矿最魁梧的人，络腮胡，厚实工装领口立起，肩上缠一圈电缆，腰挂大扳手，手上绝缘手套",
  "archetype": "grappler",
  "stage": "s06",
  "colors": {
    "primary": "#4a4f57",
    "secondary": "#c98a3d",
    "skin": "#b98a5e"
  },
  "intro": "来，让我看看你的接线牢不牢。",
  "story": "智能化改造要换掉他亲手维护了二十年的老设备。他心里想要的是：改造的设备，得由他的人来管。",
  "ending": "新设备进矿那天，厂家工程师来培训，讲到一半，雷钧举手指出了说明书上的两处错误。三个月后，他成了矿上智能装备维护中心的主任。",
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
      "name": "快拳",
      "startup": 5,
      "active": 3,
      "recovery": 10,
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
      "recovery": 15,
      "damage": 61,
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
      "name": "扳手重击",
      "startup": 9,
      "active": 4,
      "recovery": 23,
      "damage": 102,
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
      "recovery": 12,
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
      "recovery": 17,
      "damage": 66,
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
      "name": "缆线旋踢",
      "startup": 11,
      "active": 4,
      "recovery": 25,
      "damage": 107,
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
      "recovery": 10,
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
      "recovery": 15,
      "damage": 56,
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
      "name": "扳手勾拳",
      "startup": 8,
      "active": 5,
      "recovery": 25,
      "damage": 97,
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
      "recovery": 12,
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
      "recovery": 18,
      "damage": 56,
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
      "name": "电缆扫堂",
      "startup": 10,
      "active": 4,
      "recovery": 27,
      "damage": 92,
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
      "recovery": 7,
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
      "recovery": 9,
      "damage": 61,
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
      "recovery": 11,
      "damage": 92,
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
      "recovery": 7,
      "damage": 41,
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
      "recovery": 9,
      "damage": 66,
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
      "recovery": 11,
      "damage": 97,
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
    "name": "电缆抱摔",
    "damage": 150,
    "stun": 12
  },
  "specials": [
    {
      "id": "zhongdan",
      "name": "电缆缠摔",
      "input": "360P",
      "desc": "一圈指令投，电缆缠抱摔砸地",
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
      "name": "扳手砸",
      "input": "421P",
      "desc": "后下下后大扳手下砸，下段击倒",
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
      "name": "绝缘靴踹",
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
    },
    {
      "id": "lansao",
      "name": "缆鞭踢",
      "input": "421K",
      "desc": "后下下后重脚，肩上电缆甩踢，下段击倒",
      "startup": 14,
      "active": 6,
      "recovery": 28,
      "damage": 120,
      "chip": 15,
      "stun": 14,
      "hitstun": 20,
      "blockstun": 16,
      "level": "low",
      "knockdown": true,
      "hitbox": {
        "x": -6,
        "y": 0,
        "w": 62,
        "h": 40
      },
      "anim": "sweep"
    }
  ],
  "supers": [
    {
      "id": "chaozhong",
      "name": "高压送电",
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
