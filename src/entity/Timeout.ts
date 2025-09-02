import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Timeout {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    user: string

    @Column()
    reason: string

    @Column()
    issuedBy: string

    @Column()
    expiresAt: Date

    @Column({ default: true })
    isActive: boolean

    @Column({ default: 0})
    type: number

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}
