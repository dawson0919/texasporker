import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '@/utils/supabase/server'

export async function POST(req: Request) {
    // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
        console.error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
        // We shouldn't fail the request in preview mode if secret isn't set, just skip for local dev fallback
        // return new Response('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local', {
        //   status: 400
        // })
    }

    // Get the headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get("svix-id")
    const svix_timestamp = headerPayload.get("svix-timestamp")
    const svix_signature = headerPayload.get("svix-signature")

    // If there are no headers and secret is set, error out
    if (WEBHOOK_SECRET && (!svix_id || !svix_timestamp || !svix_signature)) {
        return new Response('Error occured -- no svix headers', {
            status: 400
        })
    }

    // Get the body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    let evt: WebhookEvent

    if (WEBHOOK_SECRET) {
        // Create a new Svix instance with your secret.
        const wh = new Webhook(WEBHOOK_SECRET)

        // Verify the payload with the headers
        try {
            evt = wh.verify(body, {
                "svix-id": svix_id as string,
                "svix-timestamp": svix_timestamp as string,
                "svix-signature": svix_signature as string,
            }) as WebhookEvent
        } catch (err) {
            console.error('Error verifying webhook:', err)
            return new Response('Error occured', {
                status: 400
            })
        }
    } else {
        // Local dev fallback without verification
        evt = payload as WebhookEvent
    }

    // Handle the webhook event for user.created
    if (evt.type === 'user.created') {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data
        const email = email_addresses[0]?.email_address
        const name = [first_name, last_name].filter(Boolean).join(' ') || 'Player'

        console.log(`Webhook: Storing newly created user ${id} in Supabase`)

        // 1. Insert user into public.users
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([
                { auth_id: id, email, name, avatar_url: image_url }
            ])
            .select('id')
            .single()

        if (userError) {
            console.error('Error inserting user to Supabase:', userError)
            return new Response('Error creating user in Supabase', { status: 500 })
        }

        // 2. Insert starting balance into public.balances
        if (newUser) {
            const { error: balanceError } = await supabase
                .from('balances')
                .insert([
                    { user_id: newUser.id, chip_balance: 10000 }
                ])

            if (balanceError) {
                console.error('Error inserting starting balance:', balanceError)
                return new Response('Error granting starting balance', { status: 500 })
            }
            console.log(`Webhook: Granted $10,000 starting balance to ${id}`)
        }
    }

    return new Response('', { status: 200 })
}
