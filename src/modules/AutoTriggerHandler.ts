import { Message } from 'discord.js';
import Bot from '../Bot';

export default class AutoTriggerHandler {
    private client: Bot;
    
    private static readonly MEOW_REPLY_CHANCE = 50;
    private static readonly TAUNT_CHANCE = 10;

    constructor(client: Bot) {
        this.client = client;
    }

    async handleAutoTriggers(message: Message): Promise<boolean> {
        if (message.guild?.id !== process.env.GUILD_ID) return false;

        if (await this.checkTauntTriggers(message)) return true;

        if (message.mentions.has(this.client.user!.id)) {
            return await this.handleMentions(message);
        }

        return false;
    }

    private async checkTauntTriggers(message: Message): Promise<boolean> {
        const msg = message.content.toLowerCase();
        
        if (!msg.includes('meow') && !msg.includes(':meow:') && !msg.includes(':hehe:')) {
            return false;
        }

        const meowEmoji = this.client.emojiCache.get('meow');
        const heheEmoji = this.client.emojiCache.get('hehe');
        let triggered = false;

        if (meowEmoji && message.content.includes(meowEmoji.toString())) triggered = true;
        if (heheEmoji && message.content.includes(heheEmoji.toString())) triggered = true;  
        if (/\bmeow/i.test(message.content)) triggered = true;

        if (triggered && Math.floor(Math.random() * AutoTriggerHandler.TAUNT_CHANCE) === 0) {
            await message.reply('Do you believe youself to be amusing, pest? Or do you long for annihilation so dearly?');
            return true;
        }

        return false;
    }

    private async handleMentions(message: Message): Promise<boolean> {
        // Don't respond to build commands
        if (message.content.toLowerCase().includes('build')) {
            return false;
        }

        if (Math.floor(Math.random() * AutoTriggerHandler.MEOW_REPLY_CHANCE) === 0) {
            const emoji = this.client.emojiCache.get('meow');
            const roleId = process.env.MEOW_ROLE_ID || '1390696959630774302';
            const role = await message.guild!.roles.fetch(roleId);
            
            if (emoji && role && message.member && !message.member.roles.cache.has(roleId)) {
                try {
                    await message.member.roles.add(role);
                    this.client.logger.log({ 
                        message: `Assigned 'meow' role to ${message.author.tag}.`, 
                        handler: this.constructor.name 
                    }, true);
                } catch (error) {
                    this.client.logger.error({ 
                        message: `Failed to assign 'meow' role to ${message.author.tag}.`, 
                        error, 
                        handler: this.constructor.name 
                    });
                }
            }

            if (emoji) {
                await message.reply({ content: emoji.toString() });
                return true;
            }
        }

        await message.reply('YOUR SOUL IS MINE!');
        return true;
    }
} 