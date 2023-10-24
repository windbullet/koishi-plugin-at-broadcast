import { Context, Schema, segment, h } from 'koishi'

export const name = 'at-broadcast'

export const using = ['database']

export const usage = `
## 如果你是旧版本用户，需要在数据库中的broadcastData表中向空的group字段中添加组名或删除该项目，否则可能会遇到bug

群聊使用方法：

> 创建订阅分组 <组名>
>> 需要超级管理员  
>> 创建一个分组，广播时按分组广播

> 删除订阅分组 <组名>
>> 需要超级管理员  
>> 删除一个分组

> 订阅广播 <组名>  
>> 这个分组有广播时会被at

> 取消订阅广播 <组名>  
>> 取消订阅这个分组的广播

私聊使用方法：  

> 发起广播 <群号> <组名> <广播内容>  
>> 需要超级管理员  
>> 向指定群聊的指定分组广播

> 全域广播 <组名> <广播内容>  
>> 需要超级管理员  
>> 向所有群的指定分组广播
`

declare module 'koishi' {
  interface Tables {
      broadcastData: BroadcastData
  }
}

export interface BroadcastData {
  id: number;
  guildId: string;
  userId: string[];
  group: string;
}

export interface Config {
  超级管理员:string[]
}

export const Config: Schema<Config> = Schema.object({
  超级管理员:Schema.array(Schema.string())
  .description("允许广播或全域广播的人，每个项目放一个ID"),
})

export function apply(ctx: Context, config: Config) {
  extendTable(ctx)
  ctx.command("广播", "订阅制广播")

  ctx.guild().command("广播").subcommand(".创建订阅分组 <name:string>", "创建一个分组，广播时按分组广播", {checkArgCount: true}).alias("创建订阅分组")
    .example("广播.创建订阅分组 Koishi更新通知")
    .action(async ({session}, name) => {
      if (config.超级管理员.includes(session.event.user.id)) {
        let data = await ctx.database.get("broadcastData", {
          guildId: session.event.guild.id,
          group: name,
        })
        if (data.length !== 0) {
          return h("quote", {id: session.event.message.id}) + "该分组已存在"
        } else {
          await ctx.database.create("broadcastData", {
            guildId: session.event.guild.id,
            group: name,
            userId: [],
          })
          return h("quote", {id: session.event.message.id}) + "订阅分组创建成功"
        }
      } 
      return h("quote", {id: session.event.message.id}) + "你没有权限"
    })

  ctx.guild().command("广播").subcommand(".删除订阅分组 <group:string>", "删除一个分组", {checkArgCount: true}).alias("删除订阅分组")
    .example("广播.删除订阅分组 Koishi更新通知")
    .action(async ({session}, group) => {
      if (config.超级管理员.includes(session.event.user.id)) {
        let data = await ctx.database.get("broadcastData", {
          guildId: session.event.guild.id,
          group: group,
        })
        if (data.length === 0) {
          return h("quote", {id: session.event.message.id}) + "该分组不存在"
        }
        await ctx.database.remove("broadcastData", {
          guildId: session.event.guild.id,
          group: group,
        })
        return h("quote", {id: session.event.message.id}) + "删除订阅分组成功"
      } 
      return h("quote", {id: session.event.message.id}) + "你没有权限"
    })

  ctx.guild().command("广播").subcommand(".订阅广播 <group:string>", "订阅的分组有广播时你将会被at", {checkArgCount: true}).alias("订阅广播")
    .action(async ({session}, group) => {
      let data = await ctx.database.get("broadcastData", {
        guildId: session.event.guild.id,
        group: group,
      });

      if (data.length === 0) {
        return h("quote", {id: session.event.message.id}) + "该分组不存在"
      } else if (data[0].userId.includes(session.event.user.id)) {
        return h("quote", {id: session.event.message.id}) + "你已经订阅了该分组"
      } else {
        data[0].userId.push(session.event.user.id)
        await ctx.model.set("broadcastData", {guildId: session.event.guild.id, group: group}, {
          userId: data[0].userId,
        })
        return h("quote", {id: session.event.message.id}) + "订阅成功"
      }
      
    })

  ctx.guild().command("广播").subcommand(".取消订阅广播 <group:string>", {checkArgCount: true}).alias("取消订阅广播")
    .action(async ({session}, group) => {
      let data = await ctx.database.get("broadcastData", {
        guildId: session.event.guild.id,
        group: group,
      });
      if (data.length === 0) {
        return h("quote", {id: session.event.message.id}) + "该分组不存在"
      } else if (!data[0].userId.includes(session.event.user.id)) {
        return h("quote", {id: session.event.message.id}) + "你没有订阅该分组"
      } else {
        data[0].userId.splice(data[0].userId.indexOf(session.event.user.id), 1)
        await ctx.model.set("broadcastData", {guildId: session.event.guild.id, group: group}, {
          userId: data[0].userId,
        })
        return h("quote", {id: session.event.message.id}) + "取消订阅成功"
      }
      
    })

  ctx.private().command("广播").subcommand(".发起广播 <guildId:string> <group:string> <message:text>", "向指定群的指定分组广播消息", {checkArgCount: true}).alias("发起广播")
    .example("广播.发起广播 114514 Koishi更新通知 Koishi更新了5.14.1版本")
    .action(async ({session}, guildId, group, message) => {
      if (config.超级管理员.includes(session.event.user.id)) {
        let result = ""
        let data = await ctx.database.get("broadcastData", {
          guildId: guildId,
          group: group,
        });

        if (data.length === 0) {
          return h("quote", {id: session.event.message.id}) + "该分组不存在"
        } else if (data[0].userId.length === 0) {
          return h("quote", {id: session.event.message.id}) + "该分组没有订阅者"
        }

        for (let i of data[0].userId) {
          result += `<at id="${+i}"/>`
        }
        result += ` ${message}`
        session.bot.sendMessage(guildId, result)
        return h("quote", {id: session.event.message.id}) + `群聊：${guildId}\n分组：${group}\n广播成功`
      }
      return h("quote", {id: session.event.message.id}) + "你没有权限"
    })

  ctx.private().command("广播").subcommand(".全域广播 <group:string> <message:text>", "向所有群的指定分组广播消息", {checkArgCount: true}).alias("全域广播")
    .example("广播.全域广播 Koishi更新了5.14.1版本")
    .action(async ({session}, group, message) => {
      if (config.超级管理员.includes(session.event.user.id)) {
        let guilds = ["收到广播的群聊："]
        let data = await ctx.database
        .select("broadcastData")
        .where({group: group})
        .execute()
        if (data.length === 0) {
          return h("quote", {id: session.event.message.id}) + "所有群都不存在该分组"
        }
        for (let i of data) {
          let result = ""
          for (let j of i.userId) {
            result += `<at id="${+j}"/>`
          }
          result += ` ${message}`
          session.bot.sendMessage(i.guildId, result)
          guilds.push(i.guildId)
        }
        return h("quote", {id: session.event.message.id}) + `全域广播成功\n` + guilds.join("\n")
      }
      return h("quote", {id: session.event.message.id}) + "你没有权限"
    })

}

async function extendTable(ctx) {
  await ctx.model.extend("broadcastData", {
    id: "unsigned",
    guildId: "text",
    userId: "list",
    group: "text",
  }, {autoInc: true, primary: "id"})
}