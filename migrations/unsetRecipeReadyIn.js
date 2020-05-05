/**
 * Migration script to unset the ready in time for recipes
 * Test document fetch using local Sanity Vision
 * 
 * Run this script with: `sanity exec --with-user-token migrations/unsetRecipeReadyIn.js`
 */

import client from 'part:@sanity/base/client'

const fetchDocuments = () =>
    client.fetch(`*[_type == 'post' && defined(content[0].readyIn) ][0...100]{_id, _rev, content}`)

const buildPatches = docs =>
    docs.map(doc => ({
        id: doc._id,
        patch: {
            unset: ['content.[0].readyIn'],
            // this will cause the transaction to fail if the documents has been
            // modified since it was fetched.
            ifRevisionID: doc._rev
        }
    }))

const createTransaction = patches =>
    patches.reduce((tx, patch) => tx.patch(patch.id, patch.patch), client.transaction())

const commitTransaction = tx => tx.commit()

const migrateNextBatch = async () => {
    const documents = await fetchDocuments()
    const patches = buildPatches(documents)
    if (patches.length === 0) {
        console.log('No more documents to migrate!')
        return null
    }
    console.log(
        `Migrating batch:\n %s`,
        patches.map(patch => `${patch.id} => ${JSON.stringify(patch.patch)}`).join('\n')
    )
    const transaction = createTransaction(patches)
    await commitTransaction(transaction)
    return migrateNextBatch()
}

migrateNextBatch().catch(err => {
    console.error(err)
    process.exit(1)
})