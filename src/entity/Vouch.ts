import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Vouch {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    voucher: string

    @Column()
    vouchee: string

    @Column()
    rsn: string

    @Column()
    role: string

    @Column({ type: 'text' })
    description: string

    @Column({ nullable: true })
    ticketChannelId: string

    @Column({ nullable: true })
    ticketRole: string

    @Column({ default: 'pending' })
    status: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}