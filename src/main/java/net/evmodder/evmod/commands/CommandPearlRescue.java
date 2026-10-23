package net.evmodder.evmod.commands;

import com.mojang.brigadier.arguments.StringArgumentType;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import net.evmodder.evmod.Main;
import net.evmodder.evmod.apis.MojangProfileLookup;
import net.evmodder.evmod.apis.MojangProfileLookupConstants;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket.Action;
//? >=26.3 {
import net.minecraft.network.protocol.game.ServerboundPunchPacket;
//?} else {
/*import net.minecraft.network.protocol.game.ServerboundSwingPacket;*/
//?}
import net.minecraft.tags.BlockTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;

public final class CommandPearlRescue{
	private record Armed(String name, UUID uuid, ClientPacketListener connection, ClientLevel level, BlockHitResult hit){}
	// Accessed only on the client thread, including the packet hook after vanilla's thread handoff.
	private static Armed armed;
	private static Object armRequest;
	// Keep waiting safely after the one-shot click/cancellation, until explicit disarm or disconnect.
	private static ClientPacketListener antiAfkConnection;
	private static long nextAntiAfkNanos;
	private static String status = "Disarmed";

	public CommandPearlRescue(){
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, _) -> dispatcher.register(
				ClientCommands.literal("pearlrescue")
				.then(ClientCommands.literal("arm").then(ClientCommands.argument("name", StringArgumentType.word())
						.executes(ctx -> arm(StringArgumentType.getString(ctx, "name")))))
				.then(ClientCommands.literal("disarm").executes(_ -> {
					armed = null;
					armRequest = null;
					antiAfkConnection = null;
					message("Disarmed");
					return 1;
				}))
				.then(ClientCommands.literal("status").executes(_ -> {message(status); return 1;}))));
		ClientPlayConnectionEvents.DISCONNECT.register((_, _) -> {
			armed = null;
			armRequest = null;
			antiAfkConnection = null;
			status = "Disarmed on disconnect";
		});
		ClientTickEvents.END_CLIENT_TICK.register(CommandPearlRescue::keepActive);
	}

	private static void keepActive(final Minecraft client){
		if(antiAfkConnection == null || client.getConnection() != antiAfkConnection
				|| client.player == null || !client.player.isAlive() || client.player.isSpectator()) return;
		final long now = System.nanoTime();
		if(now - nextAntiAfkNanos < 0) return;
		nextAntiAfkNanos = now + 30_000_000_000L;
		// Animation packet only: never attack/use the aimed block, move, or rotate for anti-AFK.
		//? >=26.3 {
		antiAfkConnection.send(ServerboundPunchPacket.INSTANCE);
		//?} else {
		/*antiAfkConnection.send(new ServerboundSwingPacket(InteractionHand.MAIN_HAND));*/
		//?}
	}

	private static void message(final String text){
		status = text;
		Main.LOGGER.info("[Pearl Rescue] {}", text);
		final Minecraft client = Minecraft.getInstance();
		if(client.player != null){
			//? >=26.1 {
			client.player.sendSystemMessage(Component.literal("[Pearl Rescue] "+text));
			//?} else {
			/*client.player.displayClientMessage(Component.literal("[Pearl Rescue] "+text), false);*/
			//?}
		}
	}

	private static String readiness(final Minecraft client){
		if(client.player == null || client.level == null || client.gameMode == null) return "Not connected to a world";
		if(!client.player.isAlive() || client.player.isSpectator()) return "Must be alive and able to interact";
		if(client.player.isShiftKeyDown()) return "Release sneak before arming";
		return null;
	}

	private static BlockHitResult aimedBlock(final Minecraft client){
		final HitResult hit = client.player.pick(client.player.blockInteractionRange(), 1f, false);
		return hit instanceof BlockHitResult block && hit.getType() == HitResult.Type.BLOCK ? block : null;
	}

	private static boolean isTrigger(final BlockState state){
		return state.is(Blocks.NOTE_BLOCK) || (state.is(BlockTags.TRAPDOORS) && !state.is(Blocks.IRON_TRAPDOOR));
	}

	private static int arm(final String name){
		if(armed != null && armed.name.equalsIgnoreCase(name)){
			message("Already armed for "+armed.name+". Stay aimed here; will right-click on arrival.");
			return 1;
		}
		armed = null;
		armRequest = null;
		final Minecraft client = Minecraft.getInstance();
		final String problem = readiness(client);
		if(problem != null){message("Not armed: "+problem); return 0;}
		if(name.length() == 36){
			try{
				final UUID uuid = UUID.fromString(name);
				if(uuid.toString().equalsIgnoreCase(name)) return armResolved(name, uuid);
			}
			catch(IllegalArgumentException ignored){}
			message("Not armed: invalid player UUID");
			return 0;
		}
		if(!name.matches("[A-Za-z0-9_]{1,16}")){message("Not armed: invalid player name"); return 0;}
		final Object request = armRequest = new Object();
		final ClientPacketListener connection = client.getConnection();
		final ClientLevel level = client.level;
		message("Resolving UUID for "+name+"; NOT ARMED yet.");
		CompletableFuture.supplyAsync(() -> MojangProfileLookup.uuidLookup.getSync(name.toLowerCase(Locale.ROOT)))
				.whenComplete((uuid, error) -> client.execute(() -> {
					if(armRequest != request) return;
					armRequest = null;
					if(client.getConnection() != connection || client.level != level){message("Not armed: world/connection changed"); return;}
					if(error != null || uuid == MojangProfileLookupConstants.UUID_404){message("Not armed: could not resolve "+name); return;}
					armResolved(name, uuid);
				}));
		return 1;
	}

	private static int armResolved(final String name, final UUID uuid){
		final Minecraft client = Minecraft.getInstance();
		final String problem = readiness(client);
		if(problem != null){message("Not armed: "+problem); return 0;}
		if(client.getConnection().getPlayerInfo(uuid) != null){
			message("Not armed: "+name+" is already in the player list. No click sent.");
			return 0;
		}
		final BlockHitResult hit = aimedBlock(client);
		if(hit == null || !isTrigger(client.level.getBlockState(hit.getBlockPos()))){
			message("Not armed: aim at a stasis noteblock or hand-openable trapdoor within normal interaction reach");
			return 0;
		}
		armed = new Armed(name, uuid, client.getConnection(), client.level, hit);
		antiAfkConnection = client.getConnection();
		nextAntiAfkNanos = System.nanoTime();
		message("ARMED for "+name+". Stay aimed here; will right-click on arrival.");
		return 1;
	}

	public static void onPlayerInfo(final ClientPacketListener connection, final ClientboundPlayerInfoUpdatePacket packet){
		final Armed watch = armed;
		if(watch == null || watch.connection != connection) return;
		final boolean added = packet.actions().contains(Action.ADD_PLAYER);
		final boolean listed = packet.actions().contains(Action.UPDATE_LISTED);
		if(!added && !listed) return;
		for(var entry : packet.entries()){
			if((added || entry.listed()) && watch.uuid.equals(entry.profileId())){
				armed = null; // Consume before interaction: duplicate packets must never click twice.
				final Minecraft client = Minecraft.getInstance();
				String problem = readiness(client);
				if(problem == null && (client.getConnection() != connection || client.level != watch.level)) problem = "World/connection changed";
				if(problem == null){
					final BlockHitResult hit = aimedBlock(client);
					if(hit == null || !hit.getBlockPos().equals(watch.hit.getBlockPos())
							|| !isTrigger(client.level.getBlockState(hit.getBlockPos()))) problem = "No longer aiming at the armed noteblock or trapdoor within reach";
					else{
						// Normal, sequenced interaction, without a timer or queued task.
						client.gameMode.useItemOn(client.player, InteractionHand.MAIN_HAND, hit);
						final var info = entry.profile() == null ? connection.getPlayerInfo(watch.uuid) : null;
						final String name = entry.profile() != null ? entry.profile().name() : info != null ? info.getProfile().name() : watch.name;
						message("FIRED for "+name+"; right-click sent, now disarmed. Teleport is NOT confirmed.");
						return;
					}
				}
				message("CANCELLED for "+watch.name+": "+problem+". No click sent; re-arm explicitly.");
				return;
			}
		}
	}
}