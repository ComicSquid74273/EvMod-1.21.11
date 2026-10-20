package net.evmodder.evmod.listeners;

import net.evmodder.evmod.Configs;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.Fireworks;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;

public final class FireworkBoostListener{
	public FireworkBoostListener(){
		UseBlockCallback.EVENT.register((Player player, Level world, InteractionHand hand, BlockHitResult _) -> {
			if(!world.isClientSide() || !Configs.Generic.DONT_WASTE_FIREWORKS.getBooleanValue() || !player.isFallFlying()) return InteractionResult.PASS;
			final ItemStack stack = player.getItemInHand(hand);
			if(!stack.is(Items.FIREWORK_ROCKET)) return InteractionResult.PASS;
			final Fireworks fireworks = stack.get(DataComponents.FIREWORKS);
			if(fireworks != null && !fireworks.explosions().isEmpty()) return InteractionResult.PASS;
			// Cancel block use without consuming the click or sending a block packet; vanilla then tries item use in air.
			return InteractionResult.TRY_WITH_EMPTY_HAND;
		});
	}
}