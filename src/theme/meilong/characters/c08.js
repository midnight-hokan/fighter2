// 沈清「矿医院医生」— balanced（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c08",
  "name": "沈清",
  "title": "矿医院医生",
  "style": "三十五岁清瘦冷静，白大褂外套工作马甲，戴安全帽，听诊器挂脖子，腰挂红十字急救包，袖口别一排银针",
  "archetype": "balanced",
  "stage": "s05",
  "colors": {
    "primary": "#c9cdd4",
    "secondary": "#cc3344",
    "skin": "#d3a982"
  },
  "intro": "放松。只是例行检查。",
  "story": "她不想参赛，是被矿长\"请\"来把守最后一关的。不过她心里清楚：擂台上每一个人的身体，她都要亲眼看着。",
  "ending": "沈清赢了所有人，把头灯放回矿史馆，然后在擂台记录本上写下了每个人的体检意见：罗铮的腰、雷钧的血压、严正的旧伤、霍兰的膝盖……最后一行写着：\"全员合格。下次比武，请提前预约体检。\"",
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
      "name": "快拳",
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
      "name": "侧踹",
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
      "name": "旋踢",
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
      "name": "蹲快拳",
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
      "name": "低踢",
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
      "name": "扫堂腿",
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
      "name": "跳拳",
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
      "name": "跳旋踢",
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
    "name": "按压摔",
    "damage": 120,
    "stun": 10
  },
  "specials": [
    {
      "id": "huiyan",
      "name": "银针连射",
      "input": "236P",
      "desc": "袖口银针连射，飞行道具",
      "startup": 14,
      "active": 1,
      "recovery": 32,
      "damage": 48,
      "chip": 8,
      "stun": 8,
      "hitstun": 15,
      "blockstun": 12,
      "projectile": {
        "speed": 2.8,
        "x": 32,
        "y": 56,
        "w": 24,
        "h": 16,
        "life": 130
      },
      "anim": "fireball"
    },
    {
      "id": "huihe",
      "name": "急救突进",
      "input": "214K",
      "desc": "下后下跃起回旋踢，跃起突进",
      "startup": 10,
      "active": 8,
      "recovery": 22,
      "damage": 55,
      "chip": 10,
      "stun": 11,
      "hitstun": 18,
      "blockstun": 13,
      "knockdown": true,
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
      "name": "点穴上挑",
      "input": "623K",
      "desc": "点穴手法上挑旋踢，对空",
      "startup": 9,
      "active": 8,
      "recovery": 30,
      "damage": 95,
      "chip": 10,
      "stun": 12,
      "hitstun": 20,
      "blockstun": 14,
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
    },
    {
      "id": "zhenxiansao",
      "name": "针线扫",
      "input": "3HK",
      "desc": "后下重脚，银针线低扫，下段",
      "startup": 9,
      "active": 4,
      "recovery": 20,
      "damage": 75,
      "chip": 10,
      "stun": 9,
      "hitstun": 15,
      "blockstun": 11,
      "level": "low",
      "hitbox": {
        "x": -2,
        "y": 0,
        "w": 50,
        "h": 14
      },
      "anim": "sweep"
    }
  ],
  "supers": [
    {
      "id": "huiyanlong",
      "name": "妙手回春",
      "input": "214214P",
      "desc": "银针龙卷，中距离贯穿",
      "startup": 14,
      "active": 10,
      "recovery": 40,
      "damage": 200,
      "chip": 32,
      "stun": 0,
      "hitstun": 26,
      "blockstun": 20,
      "knockdown": true,
      "invuln": [
        1,
        6
      ],
      "hitbox": {
        "x": 6,
        "y": 20,
        "w": 68,
        "h": 64
      },
      "move": {
        "vx": 2.4,
        "frames": 12,
        "at": 10
      },
      "anim": "super",
      "sdm": {
        "damage": 340
      }
    }
  ]
};
