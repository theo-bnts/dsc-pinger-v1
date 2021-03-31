const Discord = require('discord.js');
const fs = require('fs');
const clock = require('date-events')();
const needle = require('needle');

const client = new Discord.Client();

////////// UNDER DEVELOPMENT //////////
/*
client.on('presenceUpdate', async (oldPres, newPres) => {
    if (newPres && newPres.user.bot && (!oldPres || oldPres.status == 'offline' || newPres.status == 'offline')) {

        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))
        if (wsyncs.some(w => w.guild == newPres.guild.id)) {

            const wsync = wsyncs.find(w => w.guild == newPres.member.guild.id)
            if (newPres.member.roles.cache.some(r => r.id == wsync.role)) {

                const downtimes = JSON.parse(fs.readFileSync('data/downtimes.json'))

                if (!downtimes.some(d => d.id == newPres.user.id))
                    downtimes.push({
                        id: newPres.user.id,
                        list: []
                    })

                const userDowntimes = downtimes.find(d => d.id == newPres.user.id)
                if (newPres.status == 'offline')
                    downtimes.list.push({
                        start: Date.now(),
                        end: null
                    })
                else if (oldPres.status == 'offline' && !downtimes.list.last().end)
                    downtimes.list.last().end == Date.now()

                fs.writeFileSync('data/downtimes.json', JSON.stringify(downtimes))

                const user = await client.users.fetch(wsync.user)
                user.send(
                    new Discord.MessageEmbed()
                        .setColor('#2f3136')
                        .setDescription(`${newPres.user} est maintenant **${newPres.status == 'offline' ? 'HORS' : 'EN'} LIGNE** sur ${newPres.guild.name} !`)
                )
            }
        }
    }
})
*/

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    clock.on('minute', async () => {
        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))
        const pings = JSON.parse(fs.readFileSync('data/pings.json'))

        for (const wsync of wsyncs) {
            var guild, channel, message
            try {
                guild = client.guilds.cache.find(g => g.id == wsync.guild)
                channel = guild.channels.cache.find(c => c.id == wsync.channel)
                message = await channel.messages.fetch(wsync.message)
            } catch (e) {}

            if (!message || !message.id) return

            const embed = new Discord.MessageEmbed()
                .setColor('#2f3136')
                .setTitle('Statuts')
                .addField('\u200B', '`Robots`')
                .setFooter('Dernière mise à jour', client.user.avatarURL())
                .setTimestamp()

            for (const member of guild.members.cache) {
                if (member[1].user.bot && member[1].user != client.user && member[1].roles.cache.array().some(r => r.id == wsync.role)) {

                    if (!pings.some(b => b.id == member[1].user.id))
                        pings.push({
                            id: member[1].user.id,
                            pings: []
                        })

                    const savedPings = pings.find(b => b.id == member[1].user.id).pings
                    while (savedPings.length > 10080) savedPings.shift()
                    savedPings.push(member[1].presence.status != 'offline')
                    pings.find(b => b.id == member[1].user.id).pings = savedPings
                    fs.writeFileSync('data/pings.json', JSON.stringify(pings))

                    const botPings = pings.find(b => b.id == member[1].user.id).pings
                    const uptime = botPings.filter(p => p == true).length / botPings.length * 100

                    var emoji
                    switch (member[1].presence.status) {
                        case 'offline': emoji = '<:offline:820029341420748830>'; break;
                        case 'dnd': emoji = '<:dnd:820029341114171434>'; break;
                        case 'idle': emoji = '<:idle:820029341178134569>'; break;
                        default: emoji = '<:online:820029341450371142>'; break;
                    }

                    embed.addField(member[1].user.tag, `${emoji} **${member[1].presence.status == 'offline' ? 'HORS' : 'EN'} LIGNE** - ${uptime.toFixed(2)}% uptime (7 jours)`)
                }
            }

            if (wsync.servers.length > 0) {
                embed.addField('\u200B', '`Serveurs`')

                for (const server of wsync.servers) {
                    var reachable = true
                    try {
                        await needle('get', server.value)
                    } catch (e) {
                        reachable = false
                    }

                    if (!pings.some(b => b.id == server.value))
                        pings.push({
                            id: server.value,
                            pings: []
                        })

                    const savedPings = pings.find(p => p.id == server.value).pings
                    while (savedPings.length > 10080) savedPings.shift()
                    savedPings.push(reachable)
                    pings.find(b => b.id == server.value).pings = savedPings
                    fs.writeFileSync('data/pings.json', JSON.stringify(pings))

                    if (savedPings[savedPings.length-2] && savedPings[savedPings.length-2] != reachable) {
                        const user = await client.users.fetch(wsync.user)
                        user.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription(`${server.name} (${server.value}) est maintenant **${reachable ? 'EN' : 'HORS'} LIGNE** !`))
                    }

                    const serverPings = pings.find(b => b.id == server.value).pings
                    const uptime = serverPings.filter(p => p == true).length / serverPings.length * 100

                    embed.addField(server.name, `**${reachable ? '<:online:820029341450371142> EN' : '<:offline:820029341420748830> HORS'} LIGNE** - ${uptime.toFixed(2)}% uptime (7 jours)`)
                }
            }

            embed.addField('\u200B', '\u200B')

            await message.edit(embed)
        }
    })
})

client.on('message', async (message) => {
    if (!message.content.startsWith('_')) return

    if (message.channel.type == 'dm')
        return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Vous ne pouvez pas m\'utiliser par messages privés.'))
    
    if (!message.member.hasPermission('MANAGE_GUILD'))
        return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Vous avez besoin de la permission `MANAGE_GUILD` pour m\'utiliser.'))

    if (message.content.startsWith('_wsync')) {
        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))

        if (wsyncs.some(w => w.guild == message.guild.id)) {
            const index = wsyncs.findIndex(w => w.guild == message.guild.id)
            wsyncs.splice(index, 1)
            fs.writeFileSync('data/wsync.json', JSON.stringify(wsyncs))
        }

        const embed = await message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Veuillez mentionner le rôle des bots à surveiller.'))

        const filter = (m) => {
            if (m.mentions && m.mentions.roles && m.mentions.roles.first()) return true
            else return false
        } 

        message.channel.awaitMessages(filter, {max:1, time: 60000})
            .then(async (collected) => {
                wsyncs.push({
                    guild: message.guild.id,
                    channel: message.channel.id,
                    message: embed.id,
                    role: collected.first().mentions.roles.first().id,
                    servers: [],
                    user: collected.first().author.id
                })

                fs.writeFileSync('data/wsync.json', JSON.stringify(wsyncs))
            
                embed.edit(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Fin de configuration :+1:'))
                message.delete().catch(() => {})
                collected.first().delete().catch(() => {})
            })
            .catch(() => 
                embed.edit(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Annulé.'))
            )
    }

    if (message.content.startsWith('_server')) {
        const args = message.content.split(' ')
        args.shift()

        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))
        var wsync

        if (!wsyncs.some(w => w.guild == message.guild.id))
            return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Commencez par executer `_wsync`.'))
        else
            wsync = wsyncs.find(w => w.guild == message.guild.id)

        if (!args[0])
            return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('La commande s\'utilise comme cela: `_server [list / add / remove] <ip / domaine> <nom>`'))

        if (args[0] == 'list') {
            if (wsync.servers.length == 0)
                return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Votre liste de serveurs est vide.'))
            
            var list = ''
            for (const server of wsync.servers)
                list += `${server.value} (${server.name})\n`

            return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription(list))
        }

        if (args[0] == 'add') {
            if (args.length != 3)
                return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('La commande s\'utilise comme cela: `_server [add / remove] [ip / domaine] [nom]`'))
            
            if (wsync.servers.some(s => s.value == args[1]))
                return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Ce serveur est deja dans votre liste.'))

            wsync.servers.push({value: args[1], name: args[2]})
            message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Ajouté !'))
        }

        if (args[0] == 'remove') {
            if (args.length != 2)
                return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('La commande s\'utilise comme cela: `_server [add / remove] [ip / domaine]`'))

            if (!wsync.servers.some(s => s.value == args[1]))
                return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Ce serveur n\'est pas dans votre liste.'))

            wsync.servers = wsync.servers.filter(w => w.value != args[1])
            message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Supprimé !'))
        }

        wsyncs.find(w => w.guild == message.guild.id).servers = wsync.servers
        fs.writeFileSync('data/wsync.json', JSON.stringify(wsyncs))
    }
})

client.login('YOUR TOKEN');