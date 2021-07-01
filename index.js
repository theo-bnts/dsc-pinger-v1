const Discord = require('discord.js');
const fs = require('fs');
const clock = require('date-events')();
const needle = require('needle');

const client = new Discord.Client();

const conf = {
    token: 'YOUR_TOKEN',
    emojis: {
        online: '<:online:842073169410261042>',
        idle: '<:idle:842073169400561744>',
        dnd: '<:dnd:842073169111810049>',
        offline: '<:offline:842073169384701952>'
    }
}

client.on('presenceUpdate', async (oldPres, newPres) => {
    if (newPres && newPres.user.bot && (!oldPres || oldPres.status == 'offline' || newPres.status == 'offline')) {

        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))
        if (wsyncs.some(w => w.guild == newPres.guild.id)) {

            const wsync = wsyncs.find(w => w.guild == newPres.member.guild.id)
            if (newPres.member.roles.cache.some(r => wsync.roles.includes(r.id))) {

                const downtimes = JSON.parse(fs.readFileSync('data/downtimes.json'))

                if (!downtimes.some(d => d.id == newPres.user.id))
                    downtimes.push({
                        id: newPres.user.id,
                        list: []
                    })

                const userDowntimes = downtimes.find(d => d.id == newPres.user.id)
                if (newPres.status == 'offline')
                    userDowntimes.list.push({
                        start: Date.now(),
                        end: null
                    })
                else {
                    if (userDowntimes.list.length > 0 && !userDowntimes.list[userDowntimes.list.length-1].end)
                        userDowntimes.list[userDowntimes.list.length-1].end = Date.now()
                    else
                        userDowntimes.list.push({
                            start: null,
                            end: Date.now()
                        })
                } 

                downtimes.find(d => d.id == newPres.user.id).list = userDowntimes.list

                fs.writeFileSync('data/downtimes.json', JSON.stringify(downtimes))

                for (const id of wsync.users) {
                    const user = await client.users.fetch(id)
                    user.send(
                        new Discord.MessageEmbed()
                            .setColor('#2f3136')
                            .setDescription(`${newPres.user} est maintenant **${newPres.status == 'offline' ? 'HORS' : 'EN'} LIGNE** sur ${newPres.guild.name} !`)
                    )
                }

            }
        }
    }
})

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    clock.on('minute', async () => {
        client.user.setActivity(`${client.guilds.cache.size} guilds | _help`, { type: 'WATCHING' });

        const wsyncs = JSON.parse(fs.readFileSync('data/wsync.json'))
        const pings = JSON.parse(fs.readFileSync('data/pings.json'))

        for (const wsync of wsyncs) {
            var guild, channel, message
            guild = channel = message = null
            try {
                guild = await client.guilds.cache.find(g => g.id == wsync.guild)
                channel = await guild.channels.cache.find(c => c.id == wsync.channel)
                message = await channel.messages.fetch(wsync.message)
            } catch (e) {}

            if (!message || !message.id) return

            const embed = new Discord.MessageEmbed()
                .setColor('#2f3136')
                .setTitle('Statuts')
                .setFooter('Dernière mise à jour', client.user.avatarURL())
                .setTimestamp()

            for (const member of guild.members.cache) {
                if (member[1].user.bot && member[1].user != client.user && member[1].roles.cache.array().some(r => wsync.roles.includes(r.id))) {
                    if (embed.fields.length == 0)
                        embed.addField('\u200B', '`Robots`')

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

                    embed.addField(member[1].user.tag, `${conf.emojis[member[1].presence.status]} **${member[1].presence.status == 'offline' ? 'HORS' : 'EN'} LIGNE** - ${uptime.toFixed(2)}% uptime (7 jours)`)
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
                        for (const id of wsync.users) {
                            const user = await client.users.fetch(id)
                            user.send(
                                new Discord.MessageEmbed()
                                    .setColor('#2f3136')
                                    .setDescription(`${server.name} (${server.value}) est maintenant **${reachable ? 'EN' : 'HORS'} LIGNE** !`))
                        }
                    }

                    const serverPings = pings.find(b => b.id == server.value).pings
                    const uptime = serverPings.filter(p => p == true).length / serverPings.length * 100

                    embed.addField(server.name, `**${reachable ? conf.emojis.online + ' EN' :  conf.emojis.offline + ' HORS'} LIGNE** - ${uptime.toFixed(2)}% uptime (7 jours)`)
                }
            }

            if (embed.fields.length == 0)
                embed.addField('Aucun service à surveiller pour ce serveur.')
            else
                embed.addField('\u200B', '\u200B')

            await message.edit(embed)
        }
    })
})

client.on('message', async (message) => {
    if (!message.content.startsWith('_')) return

    if (message.channel.type == 'dm')
        return message.channel.send(new Discord.MessageEmbed().setColor('#2f3136').setDescription('Vous ne pouvez pas m\'utiliser par messages privés.'))

    if (message.content.startsWith('_help')) {
        message.channel.send(
            new Discord.MessageEmbed()
                .setColor('#2f3136')
                .setTitle('Commandes - Prefixe : _')
                .addFields(
                    { name: '_wsync', value: 'Configuration de base' },
                    { name: '_server', value: 'Ajouter / Supprimer un serveur / Voir la liste des serveurs ajoutés' },
                    { name: '_downtimes', value: 'Liste des downtimes d\'un bot' },
                    { name: '_invite', value: 'Inviter ' + client.user.username }
                )
        )
    }

    if (message.content.startsWith('_invite')) {
        message.channel.send(
            new Discord.MessageEmbed()
                .setColor('#2f3136')
                .setDescription('Pour m\'inviter, cliquez **[ici](https://invite-pinger.fortool.fr)**.')
                .setFooter('MIT Licence - ©Fortool')
        )
    }

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
                    roles: [collected.first().mentions.roles.first().id],
                    servers: [],
                    users: [collected.first().author.id]
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

    if (message.content.startsWith('_downtimes')) {
        const downtimes = JSON.parse(fs.readFileSync('data/downtimes.json'))
        if (message.mentions.users.first()) {
            if (downtimes.find(d => d.id == message.mentions.users.first().id) && downtimes.find(d => d.id == message.mentions.users.first().id).list && downtimes.find(d => d.id == message.mentions.users.first().id).list.length > 0) {
                var userDowntimes = downtimes.find(d => d.id == message.mentions.users.first().id)
                var desc = ''
                for (const downtime of userDowntimes.list)
                    desc += `${downtime.start ? new Date(downtime.start).toLocaleString('fr', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }) : 'Non défini'} - ${downtime.end ? new Date(downtime.end).toLocaleString('fr', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }) : 'Non défini'}\n`
                message.channel.send(
                    new Discord.MessageEmbed()
                        .setColor('#2f3136')
                        .setTitle('Temps d\'arrêt')
                        .setDescription(desc)
                )
            } else {
                message.channel.send(
                    new Discord.MessageEmbed()
                        .setColor('#2f3136')
                        .setDescription('Aucun temps d\'arrêt pour cet utilisateur.')
                )
            }
        } else {
            message.channel.send(
                new Discord.MessageEmbed()
                    .setColor('#2f3136')
                    .setDescription('La commande s\'utilise comme cela : `_downtimes [mention]`')
            )
        }
    }
})

client.login(conf.token);