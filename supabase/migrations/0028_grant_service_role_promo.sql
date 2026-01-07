-- Grant service_role full access to promo tables
GRANT ALL ON public.promo_credits TO service_role;
GRANT ALL ON public.invite_codes TO service_role;
GRANT ALL ON public.invitations TO service_role;
GRANT ALL ON public.invitation_awards TO service_role;
GRANT ALL ON public.payment_promo_applications TO service_role;
GRANT ALL ON public.promotions TO service_role;
GRANT ALL ON public.promotion_redemptions TO service_role;

-- Grant service_role execute on promo RPCs
GRANT EXECUTE ON FUNCTION public.apply_promo_to_payment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_invitation_credits(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_first_qualifying_payment(uuid, uuid) TO service_role;