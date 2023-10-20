import { Context, Schema, segment, h } from 'koishi'

export const name = 'at-broadcast'

export const using = ['database']

declare module 'koishi' {
  interface Tables {
      broadcastData: BroadcastData
  }
}

export interface BroadcastData {
  id: number;
  guildId: string;
  userId: string[];
}

export interface Config {
  超级管理员:string[]
}

export const Config: Schema<Config> = Schema.object({
  超级管理员:Schema.array(Schema.string())
  .description("允许广播或全域广播的人，每个项目放一个ID"),
})

export function apply(ctx: Context) {
  extendTable(ctx)
  ctx.guild().command("订阅广播", "有广播时你将会被at")
    .action(async ({session}) => {
      let data = await ctx.database.get("broadcastData", {
        guildId: session.event.guild.id,
      });

      if (data.length === 0) {
        await ctx.model.create("broadcastData", {
          guildId: session.event.guild.id,
          userId: [session.event.user.id],
        })
        return h("quote", {id: session.event.message.id}) + "订阅成功"
      } else if (!data[0].userId.includes(session.event.user.id)) {
        data[0].userId.push(session.event.user.id)
        await ctx.model.set("broadcastData", {guildId: session.event.guild.id}, {
          userId: data[0].userId,
        })
        return h("quote", {id: session.event.message.id}) + "订阅成功"
      }
      return h("quote", {id: session.event.message.id}) + "你已订阅过"
      
    })

  ctx.guild().command("取消订阅广播")
    .action(async ({session}) => {
      let data = await ctx.database.get("broadcastData", {
        guildId: session.event.guild.id,
      });
      if (data.length === 0 || !data[0].userId.includes(session.event.user.id)) {
        return h("quote", {id: session.event.message.id}) + "你还未订阅"
      }
      data[0].userId.splice(data[0].userId.indexOf(session.event.user.id), 1)
      await ctx.model.set("broadcastData", {guildId: session.event.guild.id}, {
        userId: data[0].userId,
      })
      return h("quote", {id: session.event.message.id}) + "已取消订阅"
    })

  ctx.private().command("广播 <guildId:string> <message:text>")
    .action(async ({session}, guildId, message) => {
      let result = ""
      let data = await ctx.database.get("broadcastData", {
        guildId: guildId,
      });
      if (data.length === 0) {
        return h("quote", {id: session.event.message.id}) + "该群还没有人订阅广播"
      }
      for (let i of data[0].userId) {
        result += `<at id="${+i}"/>`
      }
      result += ` ${message}`
      session.bot.sendMessage(guildId, result)
      return h("quote", {id: session.event.message.id}) + `群聊：${guildId} 广播成功`
    })

  ctx.private().command("全域广播 <message:text>")
    .action(async ({session}, message) => {
      let guilds = ["收到广播的群聊："]
      let data = await ctx.database
      .select("broadcastData")
      .orderBy("id", "desc")
      .execute()
      if (data.length === 0) {
        return h("quote", {id: session.event.message.id}) + "还没有人订阅广播"
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
    })

}

async function extendTable(ctx) {
  await ctx.model.extend("broadcastData", {
    id: "unsigned",
    guildId: "text",
    userId: "list",
  }, {autoInc: true, primary: "id"})
}