// 霍兰「澡堂管理员」— power（黑岭煤矿角色）
// 由 scripts/gen-characters.mjs 生成；数据格式见 docs/角色数据格式.md；身份与故事见 docs/故事设定.md
export default {
  "id": "c07",
  "name": "霍兰",
  "title": "澡堂管理员",
  "style": "四十六岁高壮结实的中年女性，白色工装上衣外罩深绿色防水胶围裙，脚穿高筒胶靴，肩搭白毛巾，腰挂一大串更衣柜钥匙，手持长柄大拖把",
  "archetype": "power",
  "stage": "s04",
  "colors": {
    "primary": "#356e46",
    "secondary": "#e8ebe0",
    "skin": "#a9765a"
  },
  "intro": "洗干净了没？没洗干净的，别想上我的擂台。",
  "story": "二十多年前最后一届擂台，她是唯一打进决赛的女人，在最后一场输给了林啸的父亲。她不是想报仇，就是一直想知道：\"如果那天我没输，会怎么样？\"",
  "ending": "霍兰捧着头灯，去林啸家敲了门。林啸的父亲开门，两人对视了很久，一起笑了出来。那天夜里，澡堂破例开到天亮，热水管够，全矿的人都来了。",
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
      "name": "快拳",
      "startup": 5,
      "active": 3,
      "recovery": 10,
      "damage": 32,
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
      "damage": 64,
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
      "name": "重拳",
      "startup": 9,
      "active": 4,
      "recovery": 23,
      "damage": 106,
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
      "damage": 37,
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
      "damage": 69,
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
      "name": "旋踢",
      "startup": 11,
      "active": 4,
      "recovery": 25,
      "damage": 111,
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
      "damage": 27,
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
      "damage": 58,
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
      "recovery": 25,
      "damage": 101,
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
      "damage": 32,
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
      "damage": 58,
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
      "name": "扫堂腿",
      "startup": 10,
      "active": 4,
      "recovery": 27,
      "damage": 95,
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
      "damage": 37,
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
      "damage": 64,
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
      "damage": 95,
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
      "recovery": 9,
      "damage": 69,
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
      "damage": 101,
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
    "name": "拖把摔",
    "damage": 140,
    "stun": 12
  },
  "specials": [
    {
      "id": "chongtiant",
      "name": "蒸汽冲天",
      "input": "623P",
      "desc": "长柄大拖把对空抡扫，起手无敌，击飞",
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
      "name": "木盆扣顶",
      "input": "421P",
      "desc": "后下下后木盆大扣，下段击倒",
      "startup": 14,
      "active": 10,
      "recovery": 30,
      "damage": 140,
      "chip": 20,
      "stun": 18,
      "hitstun": 20,
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
      "name": "拖把横扫",
      "input": "214K",
      "desc": "下后下长柄拖把横扫踹翻，击倒",
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
      "name": "开闸放水",
      "input": "214214P",
      "desc": "高压水管连环冲击，重压突进",
      "startup": 12,
      "active": 28,
      "recovery": 38,
      "damage": 320,
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
