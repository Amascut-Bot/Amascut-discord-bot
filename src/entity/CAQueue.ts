import { Column, Entity, PrimaryColumn } from 'typeorm';

export type CAQueueType = 'uo' | '4k' | 'perf';

@Entity()
export class CAQueue {
    @PrimaryColumn()
    guildId: string;

    @PrimaryColumn({ default: 'uo' })
    queueType: CAQueueType;

    @Column()
    channelId: string;

    @Column({ type: 'text', nullable: true })
    messageId: string | null;

    @Column({ type: 'simple-json' })
    signups: string[];

    @Column({ default: false })
    enabled: boolean;
}
