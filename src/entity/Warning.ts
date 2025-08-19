import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Warning {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    user: string

    @Column()
    reason: string

    @Column()
    issuedBy: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date

    @Column({ nullable: true })
    reportRef?: string;
}
