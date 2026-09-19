// Local-only dev runner. Vercel doesn't use this file — it calls api/index.js
// directly — this is just so you can run `npm run dev` and test on your own
// machine before pushing.
import app from './api/index.js';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Printify backend running locally on http://localhost:${PORT}`));
