// 严正「安监科主任」— rushdown（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c04",
  "name": "严正",
  "title": "安监科主任",
  "style": "四十八岁精干中年，白色安全帽，左臂\"安全监察\"袖标，手持瓦斯检测仪，胸袋永远插着罚单本",
  "archetype": "rushdown",
  "stage": "s02",
  "colors": {
    "primary": "#7d8a97",
    "secondary": "#c0392b",
    "skin": "#e6b98d"
  },
  "intro": "你这个站位，已经构成违章了。",
  "story": "恢复擂台的消息一出，他第一个跳出来反对。反对无效，他干脆报名：\"那我就进去盯着，谁敢违章，我当场叫停。\"",
  "ending": "严正捧着头灯，在全矿大会上第一次讲了自己被困的那十一个小时。最后他说：\"以后井下的人少了，这是我干安监这么多年，最想看到的事。\"台下安静了很久，然后掌声响了起来。",
  "stats": {
    "health": 1080,
    "walkF": 2.8,
    "walkB": 2.2,
    "jumpV": 8.8,
    "jumpH": 3.4,
    "stunMax": 95,
    "throwRange": 42
  },
  "normals": {
    "st.lp": {
      "name": "快拳",
      "startup": 3,
      "active": 3,
      "recovery": 7,
      "damage": 32,
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
      "name": "检测重击",
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
      "startup": 4,
      "active": 3,
      "recovery": 9,
      "damage": 37,
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
      "startup": 7,
      "active": 3,
      "recovery": 14,
      "damage": 68,
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
      "name": "监察旋踢",
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
      "name": "蹲快拳",
      "startup": 3,
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
      "damage": 58,
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
      "name": "低踢",
      "startup": 4,
      "active": 3,
      "recovery": 9,
      "damage": 32,
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
      "name": "罚单扫堂",
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
      "name": "跳拳",
      "startup": 4,
      "active": 6,
      "recovery": 4,
      "damage": 37,
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
      "damage": 63,
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
      "damage": 95,
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
      "damage": 42,
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
      "damage": 68,
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
      "startup": 8,
      "active": 5,
      "recovery": 8,
      "damage": 100,
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
    "name": "按倒摔",
    "damage": 130,
    "stun": 10
  },
  "specials": [
    {
      "id": "denghua",
      "name": "隐患排查",
      "input": "214P",
      "desc": "下前滑步踢，突进压制",
      "startup": 8,
      "active": 10,
      "recovery": 18,
      "damage": 105,
      "chip": 12,
      "stun": 10,
      "hitstun": 20,
      "blockstun": 12,
      "hitbox": {
        "x": -16,
        "y": 30,
        "w": 60,
        "h": 20
      },
      "move": {
        "vx": 2.8,
        "frames": 14,
        "at": 8
      },
      "anim": "kick"
    },
    {
      "id": "shanguang",
      "name": "当场整改",
      "input": "41236P",
      "desc": "下后下前跃起旋踢，起手无敌，对空",
      "startup": 9,
      "active": 12,
      "recovery": 22,
      "damage": 110,
      "chip": 12,
      "stun": 12,
      "hitstun": 18,
      "blockstun": 14,
      "knockdown": true,
      "invuln": [
        1,
        6
      ],
      "hitbox": {
        "x": -12,
        "y": 40,
        "w": 56,
        "h": 30
      },
      "move": {
        "vx": 2.2,
        "vy": 4.5,
        "at": 6
      },
      "anim": "spin"
    },
    {
      "id": "jifenghua",
      "name": "停产整顿",
      "input": "236K",
      "desc": "前冲扫踢，快速接压",
      "startup": 10,
      "active": 14,
      "recovery": 16,
      "damage": 90,
      "chip": 10,
      "stun": 8,
      "hitstun": 14,
      "blockstun": 10,
      "hitbox": {
        "x": -14,
        "y": 34,
        "w": 54,
        "h": 20
      },
      "move": {
        "vx": 3.2,
        "frames": 16,
        "at": 10
      },
      "anim": "rush"
    }
  ],
  "supers": [
    {
      "id": "huaying",
      "name": "一票否决",
      "input": "214214P",
      "desc": "罚单翻飞，连续突刺",
      "startup": 6,
      "active": 24,
      "recovery": 28,
      "damage": 330,
      "chip": 42,
      "stun": 0,
      "hitstun": 28,
      "blockstun": 20,
      "knockdown": true,
      "invuln": [
        1,
        10
      ],
      "hitbox": {
        "x": -16,
        "y": 20,
        "w": 76,
        "h": 60
      },
      "move": {
        "vx": 3.4,
        "frames": 18,
        "at": 6
      },
      "anim": "super",
      "sdm": {
        "damage": 470
      }
    }
  ]
};
