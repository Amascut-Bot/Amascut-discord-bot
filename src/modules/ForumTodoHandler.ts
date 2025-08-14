import { MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import Bot from '../Bot';

export default class ForumTodoHandler {
    private client: Bot;

    private static readonly TODO_FORUM_CHANNEL_ID = '1390011457223004191';
    private static readonly CHECK_EMOJI_ID = '885462012556083200';
    private static readonly DONE_TAG_ID = '1390011627629183158';

    constructor(client: Bot) {
        this.client = client;
    }

    async handleForumTodoReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<boolean> {
        if (user.bot) return false;

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                this.client.logger.error({
                    message: 'Failed to fetch partial reaction for forum todo',
                    error: error as Error,
                    handler: this.constructor.name
                });
                return false;
            }
        }

        if (!reaction.message.inGuild()) return false;

        const channel = reaction.message.channel;
        if (!channel.isThread() || channel.parentId !== ForumTodoHandler.TODO_FORUM_CHANNEL_ID) {
            return false;
        }

        if (reaction.emoji.id !== ForumTodoHandler.CHECK_EMOJI_ID) {
            return false;
        }

        try {
            await channel.setAppliedTags([ForumTodoHandler.DONE_TAG_ID]);
            //await channel.setLocked(true);
            //await channel.setArchived(true);

            this.client.logger.log({
                message: `Completed todo thread ${channel.name} (${channel.id}) by ${user.tag}`,
                handler: this.constructor.name
            }, true);

            return true;
        } catch (error) {
            this.client.logger.error({
                message: `Failed to complete todo thread ${channel.id}`,
                error: error as Error,
                handler: this.constructor.name
            });

            return false;
        }
    }
}
