import { GuildMember, Role, EmbedBuilder, TextChannel } from 'discord.js';
import Bot from '../Bot';
import BotEvent from '../types/BotEvent';
import { getChannels, getRoles } from '../GuildSpecifics';

export default class GuildMemberAdd extends BotEvent {
    get name(): string {
        return 'guildMemberAdd';
    }

    get fireOnce(): boolean {
        return false;
    }

    get enabled(): boolean {
        return true;
    }

    private formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }

    async run(member: GuildMember) {
        if (member.user.bot) return;

        // Only process members joining the specified guild
        if (member.guild.id !== process.env.GUILD_ID) return;

        // Account age check
        const accountAge = Date.now() - member.user.createdTimestamp;
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        if (accountAge < oneWeek) {
            const adminChannelId = getChannels(member.guild.id).ADMIN_CHANNEL;
            const adminChannel = await this.client.channels.fetch(adminChannelId) as TextChannel;

            if (adminChannel) {
                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('New User with Young Account')
                    .setDescription(`${member.user} (${member.user.tag}) has joined the server.`)
                    .addFields(
                        { name: 'User ID', value: member.id, inline: true },
                        { name: 'Account Age', value: this.formatDuration(accountAge), inline: true }
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp();

                //const rolesToPing = [this.client.util.stripRole(getRoles(adminChannel.guild.id).owner), this.client.util.stripRole(getRoles(adminChannel.guild.id).admin)];
                //const pingContent = rolesToPing.map(id => `<@&${id}>`).join(' ');
                //await adminChannel.send({ content: pingContent, embeds: [embed] });
                await adminChannel.send({ embeds: [embed] });
            }
        }

        const roleId = this.client.util.stripRole(getRoles(member.guild.id).member);
        let role: Role | null | undefined;

        try {
            role = await member.guild.roles.fetch(roleId);
        } catch (error) {
            this.client.logger.error({
                message: `Failed to fetch role with ID ${roleId}`,
                handler: this.constructor.name,
                error
            });
        }

        if (!role) {
            return this.client.logger.log({
                message: `Role with ID ${roleId} not found in guild ${member.guild.name}.`,
                handler: this.constructor.name
            }, true);
        }

        try {
            await member.roles.add(role);
            this.client.logger.log({
                message: `Assigned role ${role.name} to new member ${member.user.tag}`,
                handler: this.constructor.name
            }, true);
        } catch (error) {
            this.client.logger.error({
                message: `Failed to assign role to new member ${member.user.tag}`,
                handler: this.constructor.name,
                error
            });
        }

        // TODO: Welcome message temporarily disabled - may be re-enabled in future
        // Send welcome message
        // const welcomeChannelId = '1389379873348255864'; // IF YOU THINK ABOUT ENABLING THIS, PUT IT IN GuildSpecifics.ts!
        // const welcomeChannel = await this.client.channels.fetch(welcomeChannelId) as TextChannel;

        // if (welcomeChannel) {
        //     const welcomeEmbed = new EmbedBuilder()
        //         .setColor('Green')
        //         .setDescription(`Welcome ${member.user} to the **Amascut, Goddess of Destruction** server. Let us know if you have any questions or suggestions.`)
        //         .setImage('https://cdn.discordapp.com/attachments/1389379617915408448/1390841698610843780/amas2.png?ex=6869b9c5&is=68686845&hm=8cdfcbf838f5a57184612d3367d8f119165a5b1bdada8880d7b8d4472c758509&');

        //     try {
        //         await welcomeChannel.send({ embeds: [welcomeEmbed] });
        //         this.client.logger.log({
        //             message: `Sent welcome message for ${member.user.tag}`,
        //             handler: this.constructor.name
        //         }, true);
        //     } catch (error) {
        //         this.client.logger.error({
        //             message: `Failed to send welcome message for ${member.user.tag}`,
        //             handler: this.constructor.name,
        //             error
        //         });
        //     }
        // }
    }
}
