import { readdirSync } from 'fs';
import Bot from '../Bot';
import BotEvent from '../types/BotEvent';

export default interface EventHandler {
    client: Bot;
    built: boolean;
}
export default class EventHandler {
    constructor(client: Bot) {
        this.client = client;
        this.built = false;
    }

    async build() {
        if (this.built) return this;
        const eventFiles = readdirSync(`${this.client.location}/src/events`).filter((file) => file.endsWith('.ts'));

        for (const file of eventFiles) {
            try {
                const { default: EventClass } = await import(`${this.client.location}/src/events/${file}`);
                const botEvent: BotEvent = new EventClass(this.client);

                this.client.logger.log({ message: `Event '${botEvent.name}' loaded.`, handler: this.constructor.name, uid: `(@${botEvent.uid})` }, true);

                if (botEvent.enabled) {
                    this.client[botEvent.fireOnce ? 'once' : 'on'](botEvent.name, (...args) => botEvent.exec(...args));
                    this.client.logger.log({ message: `Listener attached for event '${botEvent.name}'.`, handler: this.constructor.name }, true);
                }
            } catch (error) {
                this.client.logger.error({ message: `Error loading event from file ${file}`, error });
            }
        }

        this.built = true;
        return this;
    }
}
