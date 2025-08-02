# Placeholder Files Created During OpenNext.js Conversion

The following files were created as minimal placeholders to fix build errors during the conversion from Cloudflare Pages to OpenNext.js on Cloudflare Workers. These files need proper implementation.

## API Route Placeholders

### Workflow API Routes
- `app/api/workflow/[id]/messages/route.ts` - Workflow messages endpoint
- `app/api/workflow/[id]/participants/route.ts` - Workflow participants endpoint  
- `app/api/workflow/[id]/status/route.ts` - Workflow status endpoint

### Auth API Routes
- `app/api/auth/[...nextauth]/route.ts` - NextAuth handlers (currently just imports from @/auth)

## Notes

These files were created because:
1. The original files were corrupted/empty (1 byte size)
2. The anchorwrite source project doesn't have equivalent implementations
3. They were needed to prevent build errors during the conversion

## Next Steps

1. Review each placeholder file
2. Implement proper functionality based on your application requirements
3. Test each endpoint to ensure it works correctly
4. Remove this documentation file once all placeholders are properly implemented

## Current Status

All placeholders return HTTP 501 (Not Implemented) responses except for the NextAuth route which properly imports the handlers from the auth module. 