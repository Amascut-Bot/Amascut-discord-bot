import { GuildMember, Role, EmbedBuilder, TextChannel } from 'discord.js';
import BotEvent from '../types/BotEvent';
import { Timeout } from '../entity/Timeout';

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
            const adminChannel = await this.client.channels.fetch(this.client.channelIds.uploadLogChannel) as TextChannel;

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

                await adminChannel.send({ embeds: [embed] });
            }
        }

        const roleId = accountAge < oneWeek ? this.client.roleIds.gatekeeper : this.client.roleIds.member;
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


        try {
            const timeoutRepository = this.client.dataSource.getRepository(Timeout);
            const activeTimeout = await timeoutRepository.findOne({
                where: { user: member.id, isActive: true }
            });

            if (activeTimeout && activeTimeout.expiresAt > new Date()) {
                const remainingTime = activeTimeout.expiresAt.getTime() - Date.now();

                if (activeTimeout.type === 0) {
                    await member.timeout(remainingTime, `Reapplying timeout - ${activeTimeout.reason}`);
                } else if (activeTimeout.type === 1) {
                    await member.roles.add(this.client.roleIds.teamformingTimeout).catch(() => {});
                }

                this.client.logger.log({
                    message: `Reapplied timeout to rejoining member ${member.user.tag} (${remainingTime}ms remaining)`,
                    handler: this.constructor.name
                }, true);
            } else if (activeTimeout && activeTimeout.expiresAt <= new Date()) {
                await timeoutRepository.update(activeTimeout.id, { isActive: false });
            }
        } catch (error) {
            this.client.logger.error({
                message: `Failed to check/reapply timeout for ${member.user.tag}`,
                handler: this.constructor.name,
                error
            });
        }
    }
}
